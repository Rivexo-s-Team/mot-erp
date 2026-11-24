import "server-only";
import { createClient } from "@/lib/supabase/server";

export type UsuarioPortal = {
  id: string;
  nombre: string;
  correo: string;
  puesto: string | null;
  activo: boolean;
};

/** Usuarios del portal de una cuenta. Solo los ve quien administra usuarios. */
export async function usuariosPortalDeCuenta(
  cuentaId: string,
): Promise<UsuarioPortal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios_portal")
    .select("perfiles (id, nombre, correo, puesto, activo)")
    .eq("cuenta_id", cuentaId);
  if (error) throw new Error("No se pudieron cargar los usuarios del portal.");
  return data
    .map((u) => u.perfiles)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Cuenta del usuario del portal actual, o null si no pertenece a ninguna. */
export async function miCuentaPortal(): Promise<{
  id: string;
  nombre: string;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_mi_cuenta");
  const cuenta = data?.[0];
  return cuenta ? { id: cuenta.cuenta_id, nombre: cuenta.nombre } : null;
}
