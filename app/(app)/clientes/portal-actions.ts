"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermiso } from "@/lib/auth/session";
import { leerUsuarioPortal } from "@/lib/portal/usuarios";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PERMISO = "usuarios.administrar";

/** Da acceso al portal a una persona del cliente, con contraseña temporal. */
export async function crearUsuarioPortal(cuentaId: string, formData: FormData) {
  await requirePermiso(PERMISO);
  if (!z.uuid().safeParse(cuentaId).success) redirect("/clientes");
  const volver = `/clientes/${cuentaId}/portal/nuevo`;
  const leido = leerUsuarioPortal(Object.fromEntries(formData));
  if (!leido.ok) redirect(`${volver}?error=${leido.error}`);
  const { nombre, correo, puesto, password } = leido.datos;

  // 1. Acceso (correo y contraseña): requiere la llave secreta.
  const admin = createAdminClient();
  const { data: creado, error: authError } = await admin.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
  });
  if (authError || !creado.user) {
    redirect(
      `${volver}?error=${authError?.code === "email_exists" ? "existe" : "fallo"}`,
    );
  }

  // 2. Perfil y liga a la cuenta: con la sesión de quien lo da de alta, para
  //    que RLS lo valide y la bitácora registre quién lo hizo.
  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_usuario_portal", {
    p_usuario: creado.user.id,
    p_cuenta: cuentaId,
    p_nombre: nombre,
    p_correo: correo,
    p_puesto: puesto,
  });
  if (error) {
    await admin.auth.admin.deleteUser(creado.user.id);
    redirect(`${volver}?error=fallo`);
  }

  revalidatePath(`/clientes/${cuentaId}`);
  redirect(`/clientes/${cuentaId}`);
}

/** Activa o desactiva a un usuario del portal de esta cuenta. */
export async function cambiarAccesoPortal(
  cuentaId: string,
  perfilId: string,
  activo: boolean,
) {
  await requirePermiso(PERMISO);
  const supabase = await createClient();
  // Solo si de verdad es un usuario del portal de esta cuenta.
  const { data: liga } = await supabase
    .from("usuarios_portal")
    .select("perfil_id")
    .eq("cuenta_id", cuentaId)
    .eq("perfil_id", perfilId)
    .maybeSingle();
  if (liga) {
    await supabase.from("perfiles").update({ activo }).eq("id", liga.perfil_id);
  }
  revalidatePath(`/clientes/${cuentaId}`);
}
