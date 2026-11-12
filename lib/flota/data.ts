import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Lecturas de la flota. RLS decide qué ve cada rol. */

const COLUMNAS =
  "id, numero_serie, modelo, version_programa, sim, estado, fecha_alta, notas, created_at, updated_at";

export async function listarRobox(filtro: {
  estado?: string;
  busqueda?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("robox")
    .select(COLUMNAS)
    .is("deleted_at", null)
    .order("numero_serie");
  if (filtro.estado) query = query.eq("estado", filtro.estado);
  // Se quitan los comodines para que la búsqueda sea texto literal.
  const texto = (filtro.busqueda ?? "").replace(/[%_\\]/g, "").trim();
  if (texto) query = query.ilike("numero_serie", `%${texto}%`);

  const { data, error } = await query;
  if (error) throw new Error("No se pudo cargar la flota.");
  return data;
}

/** Cuántos Robox vigentes hay en cada estado. */
export async function contarPorEstado() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("robox")
    .select("estado")
    .is("deleted_at", null);
  if (error) throw new Error("No se pudo cargar la flota.");
  const conteo = new Map<string, number>();
  for (const r of data) conteo.set(r.estado, (conteo.get(r.estado) ?? 0) + 1);
  return { conteo, total: data.length };
}

export async function obtenerRobox(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("robox")
    .select(COLUMNAS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el Robox.");
  return data;
}
