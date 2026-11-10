"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  crearUsuarioSchema,
  editarUsuarioSchema,
  type ActionResult,
  type CrearUsuarioInput,
  type EditarUsuarioInput,
} from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PERMISO = "usuarios.administrar";

export async function crearUsuario(
  input: CrearUsuarioInput,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  const parsed = crearUsuarioSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const { nombre, correo, puesto, rolId, password } = parsed.data;

  // 1. Acceso (correo y contraseña): requiere la llave secreta.
  const admin = createAdminClient();
  const { data: creado, error: authError } = await admin.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
  });
  if (authError || !creado.user) {
    return {
      error:
        authError?.code === "email_exists"
          ? "Ya existe un usuario con ese correo."
          : "No se pudo crear el acceso del usuario.",
    };
  }

  // 2. Perfil: con la sesión de quien lo da de alta, para que RLS lo valide y
  //    la bitácora registre quién lo hizo.
  const supabase = await createClient();
  const { error: perfilError } = await supabase.from("perfiles").insert({
    id: creado.user.id,
    nombre,
    correo,
    puesto: puesto || null,
    rol_id: rolId,
  });
  if (perfilError) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { error: "No se pudo guardar el perfil del usuario." };
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function editarUsuario(
  input: EditarUsuarioInput,
): Promise<ActionResult> {
  const sesion = await requirePermiso(PERMISO);
  const parsed = editarUsuarioSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const { id, nombre, puesto, rolId, activo, password } = parsed.data;

  if (id === sesion.id) {
    return {
      error:
        "No puedes cambiar tu propio rol ni desactivarte. Pídelo a otra persona de Dirección.",
    };
  }

  const supabase = await createClient();
  const { data: actualizado, error } = await supabase
    .from("perfiles")
    .update({ nombre, puesto: puesto || null, rol_id: rolId, activo })
    .eq("id", id)
    .select("id");
  if (error || actualizado.length === 0)
    return { error: "No se pudo guardar el usuario." };

  if (password !== "") {
    const { error: passwordError } =
      await createAdminClient().auth.admin.updateUserById(id, {
        password,
      });
    if (passwordError) {
      return {
        error: "Se guardaron los datos, pero no se pudo cambiar la contraseña.",
      };
    }
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}
