import "server-only";
import { createClient } from "@/lib/supabase/server";
import { alertasDeFiltro } from "@/lib/flota/data";
import type { OportunidadDelTablero } from "./comercial";
import type { DatosDeOperacion } from "./operacion";
import type { IngresoDelMes, RenglonDePlanta } from "./tablero";

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

/** Facturado del periodo, renta vigente y Robox por cuenta, planta y moneda. */
export async function porPlanta(
  desde: string,
  hasta: string,
): Promise<RenglonDePlanta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tablero_por_planta", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw new Error("No se pudieron cargar las cifras por planta.");
  return data;
}

/**
 * Oportunidades para la parte comercial del tablero. Con RLS: solo las
 * obtiene quien ve oportunidades.
 */
export async function oportunidadesDelTablero(): Promise<
  OportunidadDelTablero[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("oportunidades")
    .select(
      "etapa, tipo, volumen_estimado_l, fecha_cierre, siguiente_paso_fecha, motivo_perdida, motivos_perdida (nombre), cuentas!inner (deleted_at)",
    )
    .is("deleted_at", null)
    .is("cuentas.deleted_at", null);
  if (error) throw new Error("No se pudieron cargar las oportunidades.");
  return data.map((o) => ({
    etapa: o.etapa,
    tipo: o.tipo,
    volumen_estimado_l: o.volumen_estimado_l,
    fecha_cierre: o.fecha_cierre,
    siguiente_paso_fecha: o.siguiente_paso_fecha,
    motivo: o.motivos_perdida?.nombre ?? o.motivo_perdida,
  }));
}

/**
 * Flota, visitas y laboratorio para la parte de operación. Con RLS: los
 * cuatro roles del tablero ven flota, órdenes y laboratorio.
 */
export async function operacionDelTablero(): Promise<
  DatosDeOperacion & { filtrosPorCambiar: number }
> {
  const supabase = await createClient();
  const [robox, ordenes, muestras, informes] = await Promise.all([
    supabase.from("robox").select("id, estado").is("deleted_at", null),
    supabase
      .from("ordenes_servicio")
      .select("tipo, estado, fecha_programada, fecha_real")
      .is("deleted_at", null),
    supabase
      .from("muestras")
      .select("estado, fecha_muestreo")
      .is("deleted_at", null),
    supabase
      .from("informes")
      .select("estado, validado_at, publicado_at")
      .is("deleted_at", null),
  ]);
  if (robox.error || ordenes.error || muestras.error || informes.error)
    throw new Error("No se pudo cargar la operación.");
  const alertas = await alertasDeFiltro(
    robox.data.filter((r) => r.estado !== "baja").map((r) => r.id),
  );
  return {
    robox: robox.data.map((r) => r.estado),
    ordenes: ordenes.data,
    muestras: muestras.data,
    informes: informes.data,
    filtrosPorCambiar: alertas.size,
  };
}
