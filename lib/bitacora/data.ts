import "server-only";
import { createClient } from "@/lib/supabase/server";
import { POR_PAGINA, rangoDeFechas, type Filtros } from "./cambios";

/** Lecturas de la bitácora. RLS solo la deja ver a quien tiene `bitacora.ver`. */

const COLUMNAS =
  "id, tabla, registro_id, operacion, datos_anteriores, datos_nuevos, usuario_id, created_at";

type Datos = Record<string, unknown> | null;

export type RenglonBitacora = {
  id: string;
  tabla: string;
  registro_id: string;
  operacion: string;
  datos_anteriores: Datos;
  datos_nuevos: Datos;
  usuario_id: string | null;
  created_at: string;
};

/** Una página de la bitácora, de lo más reciente a lo más antiguo, y el total que cumple los filtros. */
export async function listarBitacora(
  f: Filtros,
): Promise<{ renglones: RenglonBitacora[]; total: number }> {
  const supabase = await createClient();
  const { desde, antesDe } = rangoDeFechas(f);
  let query = supabase
    .from("bitacora")
    .select(COLUMNAS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA - 1);
  if (f.tabla) query = query.eq("tabla", f.tabla);
  if (f.operacion) query = query.eq("operacion", f.operacion);
  if (f.usuario) query = query.eq("usuario_id", f.usuario);
  if (f.registro) query = query.eq("registro_id", f.registro);
  if (desde) query = query.gte("created_at", desde);
  if (antesDe) query = query.lt("created_at", antesDe);
  const { data, count, error } = await query;
  // Una página más allá del final no es un error: sale vacía.
  if (error && error.code !== "PGRST103")
    throw new Error("No se pudo cargar la bitácora.");
  return {
    renglones: (data ?? []) as RenglonBitacora[],
    total: count ?? 0,
  };
}

export async function obtenerRenglon(
  id: string,
): Promise<RenglonBitacora | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bitacora")
    .select(COLUMNAS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el registro.");
  return data as RenglonBitacora | null;
}

/** Nombre de cada usuario (internos y del portal), para decir quién hizo el cambio. */
export async function nombresDeUsuarios(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre")
    .order("nombre");
  if (error) throw new Error("No se pudieron cargar los usuarios.");
  return new Map(data.map((u) => [u.id, u.nombre]));
}
