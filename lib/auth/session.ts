import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Sesion = {
  id: string;
  nombre: string;
  correo: string;
  puesto: string | null;
  rol: { clave: string; nombre: string; esInterno: boolean };
  permisos: string[];
};

/**
 * Usuario actual con su rol y permisos, o null si no hay sesión válida
 * (sin iniciar sesión, sin perfil o desactivado). Se lee una vez por petición.
 */
export const getSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const [perfil, permisos] = await Promise.all([
    supabase
      .from("perfiles")
      .select(
        "id, nombre, correo, puesto, activo, roles (clave, nombre, es_interno)",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("mis_permisos"),
  ]);

  if (!perfil.data?.activo) return null;

  return {
    id: perfil.data.id,
    nombre: perfil.data.nombre,
    correo: perfil.data.correo,
    puesto: perfil.data.puesto,
    rol: {
      clave: perfil.data.roles.clave,
      nombre: perfil.data.roles.nombre,
      esInterno: perfil.data.roles.es_interno,
    },
    permisos: permisos.data ?? [],
  };
});

/** Exige sesión. Sin ella manda a /login (o a /sin-acceso si el usuario no tiene perfil activo). */
export async function requireSesion(): Promise<Sesion> {
  const sesion = await getSesion();
  if (sesion) return sesion;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims.sub ? "/sin-acceso" : "/login");
}

export function tienePermiso(sesion: Sesion, permiso: string): boolean {
  return sesion.permisos.includes(permiso);
}

/**
 * Exige un permiso. Es una comodidad para la interfaz: la protección real de
 * los datos está en las políticas RLS de la base.
 */
export async function requirePermiso(permiso: string): Promise<Sesion> {
  const sesion = await requireSesion();
  if (!tienePermiso(sesion, permiso)) redirect("/");
  return sesion;
}
