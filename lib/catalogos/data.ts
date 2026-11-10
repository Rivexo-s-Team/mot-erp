import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Catalogo, Fila } from "./config";

/**
 * Acceso a las tablas de catálogo por nombre. El nombre de la tabla sale de la
 * configuración (nunca del usuario) y RLS decide qué puede ver o cambiar cada quien.
 */
async function tabla(catalogo: Catalogo) {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from(catalogo.tabla);
}

export async function listarCatalogo(catalogo: Catalogo): Promise<Fila[]> {
  let query = (await tabla(catalogo)).select("*");
  for (const columna of catalogo.ordenarPor) query = query.order(columna);
  const { data, error } = await query;
  if (error)
    throw new Error(`No se pudo cargar el catálogo de ${catalogo.titulo}.`);
  return data as Fila[];
}

export async function obtenerDeCatalogo(
  catalogo: Catalogo,
  id: string,
): Promise<Fila | null> {
  const { data, error } = await (
    await tabla(catalogo)
  )
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new Error(`No se pudo cargar el registro de ${catalogo.titulo}.`);
  return data as Fila | null;
}

/** Guarda con la sesión del usuario. Devuelve un mensaje de error o null. */
export async function guardarEnCatalogo(
  catalogo: Catalogo,
  id: string | null,
  fila: Fila,
): Promise<string | null> {
  const t = await tabla(catalogo);
  const { data, error } = id
    ? await t.update(fila).eq("id", id).select("id")
    : await t.insert(fila).select("id");

  if (error?.code === "23505")
    return "Ya existe un registro con ese nombre o clave.";
  if (error?.code === "42501")
    return "Tu rol no puede modificar este catálogo.";
  if (error) return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
  // Con RLS, una actualización sin permiso no falla: simplemente no cambia nada.
  if (!data || data.length === 0)
    return "Tu rol no puede modificar este catálogo.";
  return null;
}
