import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Lecturas de la agenda. RLS decide qué ve cada rol. */

const COLUMNAS =
  "id, contrato_id, planta_id, equipo_cliente_id, robox_id, tecnico_id, cada_cantidad, cada_unidad, proxima_fecha, activa, notas, contratos (cuenta_id, tipo, cuentas (nombre), plantas (nombre)), equipos_cliente (identificador, alias), robox (numero_serie)";

/** Visitas recurrentes vigentes, la más próxima primero. Se puede limitar a un contrato. */
export async function listarVisitas(filtro: {
  contratoId?: string;
  soloActivas?: boolean;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("visitas_programadas")
    .select(COLUMNAS)
    .is("deleted_at", null)
    .order("proxima_fecha");
  if (filtro.contratoId) query = query.eq("contrato_id", filtro.contratoId);
  if (filtro.soloActivas) query = query.eq("activa", true);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las visitas recurrentes.");
  return data;
}

export type Visita = Awaited<ReturnType<typeof listarVisitas>>[number];

export async function obtenerVisita(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visitas_programadas")
    .select(COLUMNAS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la visita recurrente.");
  return data;
}
