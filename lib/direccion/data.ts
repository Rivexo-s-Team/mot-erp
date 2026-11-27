import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { IngresoDelMes } from "./tablero";

/** Lecturas del tablero de dirección. Las funciones de base piden `direccion.ver`. */

/** Facturado y cobrado por mes y moneda entre dos días. */
export async function ingresosPorMes(
  desde: string,
  hasta: string,
): Promise<IngresoDelMes[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tablero_ingresos", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw new Error("No se pudieron cargar los ingresos.");
  return data;
}

/** Renta mensual de los contratos vigentes, por moneda. */
export async function rentasVigentes() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tablero_rentas_vigentes");
  if (error) throw new Error("No se pudieron cargar las rentas vigentes.");
  return data;
}

/** Cargos pendientes de facturar, por moneda. */
export async function porFacturar() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tablero_por_facturar");
  if (error) throw new Error("No se pudo cargar lo pendiente de facturar.");
  return data;
}
