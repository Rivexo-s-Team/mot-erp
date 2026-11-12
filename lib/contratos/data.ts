import "server-only";
import { createClient } from "@/lib/supabase/server";
import { etiqueta, TIPOS_CONTRATO, type PartidaCotizada } from "./campos";

/** Lecturas de contratos. RLS decide qué ve cada rol (los precios, solo con precios.ver). */

const COLUMNAS =
  "id, cuenta_id, planta_id, razon_social_id, tipo, estado, referencia, contrato_origen_id, oportunidad_id, cotizacion_id, fecha_inicio, fecha_termino, moneda, incluye_filtros, incluye_laboratorio, frecuencia_visitas, notas, updated_at, cuentas!inner (nombre, deleted_at), plantas (nombre), razones_sociales (razon_social, rfc)";

export async function listarContratos(filtro: {
  estado?: string;
  cuentaId?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("contratos")
    .select(COLUMNAS)
    .is("deleted_at", null)
    .is("cuentas.deleted_at", null)
    .order("fecha_termino", { ascending: true, nullsFirst: false });
  if (filtro.estado) query = query.eq("estado", filtro.estado);
  if (filtro.cuentaId) query = query.eq("cuenta_id", filtro.cuentaId);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar los contratos.");
  return data;
}

export type Contrato = Awaited<ReturnType<typeof listarContratos>>[number];

/** Nombre corto para listas y títulos: "Renta · Lechería". */
export const nombreContrato = (c: {
  tipo: string;
  plantas: { nombre: string } | null;
}) =>
  `${etiqueta(TIPOS_CONTRATO, c.tipo)} · ${c.plantas?.nombre ?? "Sin planta"}`;

/** Cuántos contratos vigentes en el sistema hay en cada estado. */
export async function contarContratosPorEstado() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contratos")
    .select("estado, cuentas!inner (deleted_at)")
    .is("deleted_at", null)
    .is("cuentas.deleted_at", null);
  if (error) throw new Error("No se pudieron cargar los contratos.");
  const conteo = new Map<string, number>();
  for (const c of data) conteo.set(c.estado, (conteo.get(c.estado) ?? 0) + 1);
  return { conteo, total: data.length };
}

export async function obtenerContrato(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contratos")
    .select(COLUMNAS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el contrato.");
  if (!data || data.cuentas.deleted_at !== null) return null;
  return data;
}

/** Totales por contrato (solo trae algo para quien puede ver precios). */
export async function totalesDeContratos(ids: string[]) {
  const totales = new Map<
    string,
    { total_mensual: string; total_unico: string; tarifas: number }
  >();
  if (ids.length === 0) return totales;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contrato_totales")
    .select("contrato_id, total_mensual, total_unico, tarifas")
    .in("contrato_id", ids);
  if (error) throw new Error("No se pudieron cargar los totales.");
  for (const t of data) {
    if (!t.contrato_id) continue;
    totales.set(t.contrato_id, {
      total_mensual: String(t.total_mensual ?? 0),
      total_unico: String(t.total_unico ?? 0),
      tarifas: t.tarifas ?? 0,
    });
  }
  return totales;
}

export async function tarifasDeContrato(contratoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contrato_tarifas")
    .select(
      "id, orden, concepto, unidad, precio, equipo_cliente_id, orden_compra_id, notas, equipos_cliente (identificador, alias), ordenes_compra (numero)",
    )
    .eq("contrato_id", contratoId)
    .is("deleted_at", null)
    .order("orden")
    .order("created_at");
  if (error) throw new Error("No se pudieron cargar las tarifas.");
  return data;
}

/** Órdenes de compra de un contrato (solo las ve quien puede ver precios). */
export async function ordenesDeContrato(contratoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordenes_compra")
    .select("id, numero, monto, fecha_inicio, fecha_termino, notas")
    .eq("contrato_id", contratoId)
    .is("deleted_at", null)
    .order("fecha_termino", { ascending: true, nullsFirst: false })
    .order("numero");
  if (error) throw new Error("No se pudieron cargar las órdenes de compra.");
  return data;
}

/** Contratos que nacieron como ampliación de este. */
export async function ampliacionesDe(contratoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contratos")
    .select("id, tipo, estado, plantas (nombre)")
    .eq("contrato_origen_id", contratoId)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw new Error("No se pudieron cargar las ampliaciones.");
  return data;
}

/** El contrato que nació de una oportunidad, si ya existe. */
export async function contratoDeOportunidad(oportunidadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contratos")
    .select("id, estado")
    .eq("oportunidad_id", oportunidadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el contrato.");
  return data;
}

// Opciones para los formularios ----------------------------------------------

export async function razonesSocialesDeCuenta(cuentaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("razones_sociales")
    .select("id, razon_social, rfc")
    .eq("cuenta_id", cuentaId)
    .is("deleted_at", null)
    .order("razon_social");
  if (error) throw new Error("No se pudieron cargar las razones sociales.");
  return data.map((r) => ({
    value: r.id,
    label: `${r.razon_social} (${r.rfc})`,
  }));
}

/** Otros contratos de la cuenta, para marcar uno como origen de una ampliación. */
export async function contratosParaOrigen(
  cuentaId: string,
  exceptoId?: string,
) {
  const contratos = await listarContratos({ cuentaId });
  return contratos
    .filter((c) => c.id !== exceptoId)
    .map((c) => ({
      value: c.id,
      label: `${nombreContrato(c)}${c.referencia ? ` · ${c.referencia}` : ""}${c.fecha_termino ? ` · termina ${c.fecha_termino.split("-").reverse().join("/")}` : ""}`,
    }));
}

export async function equiposDePlanta(plantaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipos_cliente")
    .select("id, identificador, alias")
    .eq("planta_id", plantaId)
    .is("deleted_at", null)
    .order("identificador");
  if (error) throw new Error("No se pudieron cargar los equipos.");
  return data.map((e) => ({
    value: e.id,
    label: `${e.identificador}${e.alias ? ` (${e.alias})` : ""}`,
  }));
}

/**
 * La cotización aceptada más reciente de una oportunidad, con sus partidas.
 * Devuelve null si no hay o si quien consulta no puede ver precios.
 */
export async function cotizacionAceptada(oportunidadId: string) {
  const supabase = await createClient();
  const { data: cotizacion, error } = await supabase
    .from("cotizaciones")
    .select("id, folio, version, moneda")
    .eq("oportunidad_id", oportunidadId)
    .eq("estado", "aceptada")
    .is("deleted_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la cotización.");
  if (!cotizacion) return null;

  const { data: lineas, error: errorLineas } = await supabase
    .from("cotizacion_lineas")
    .select(
      "orden, concepto, unidad, precio_unitario, importe, recurrente, equipo_cliente_id, equipos_cliente (planta_id)",
    )
    .eq("cotizacion_id", cotizacion.id)
    .is("deleted_at", null)
    .order("orden")
    .order("created_at");
  if (errorLineas) throw new Error("No se pudo cargar la cotización.");

  const partidas: PartidaCotizada[] = lineas.map((l) => ({
    orden: l.orden,
    concepto: l.concepto,
    unidad: l.unidad,
    precio_unitario: l.precio_unitario,
    importe: l.importe ?? 0,
    recurrente: l.recurrente,
    equipo_cliente_id: l.equipo_cliente_id,
    equipo_planta_id: l.equipos_cliente?.planta_id ?? null,
  }));
  return { ...cotizacion, partidas };
}
