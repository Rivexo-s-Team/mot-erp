import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_EN_PROCESO, type OpcionesMuestra } from "./muestras";
import type { ContextoMuestra, Umbrales } from "./evaluacion";
import type { ParametroLab } from "./resultados";

/** Lecturas de muestras. RLS: quien tiene laboratorio.ver. */

const COLUMNAS =
  "id, id_muestra, cuenta_id, planta_id, equipo_cliente_id, orden_id, oportunidad_id, id_caso, tipo, tomada_por, fecha_muestreo, fecha_recepcion, nivel_analisis, estado, punto_muestreo, condicion_operacion, notas, created_at, cuentas (nombre), plantas (nombre), equipos_cliente (identificador, alias, aceites (marca, nombre_comercial, viscosidad_nominal_40c)), ordenes_servicio (folio), oportunidades (nombre)";

export async function listarMuestras(filtro: {
  estado?: string;
  /** Por recibir, recibidas y en análisis. */
  enProceso?: boolean;
  ordenId?: string;
  oportunidadId?: string;
  equipoId?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("muestras")
    .select(COLUMNAS)
    .is("deleted_at", null)
    .order("fecha_muestreo", { ascending: false })
    .order("id_muestra", { ascending: false });
  if (filtro.estado) query = query.eq("estado", filtro.estado);
  if (filtro.enProceso) query = query.in("estado", ESTADOS_EN_PROCESO);
  if (filtro.ordenId) query = query.eq("orden_id", filtro.ordenId);
  if (filtro.oportunidadId)
    query = query.eq("oportunidad_id", filtro.oportunidadId);
  if (filtro.equipoId) query = query.eq("equipo_cliente_id", filtro.equipoId);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las muestras.");
  return data;
}

export type Muestra = Awaited<ReturnType<typeof listarMuestras>>[number];

export async function obtenerMuestra(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("muestras")
    .select(COLUMNAS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la muestra.");
  return data;
}

/** Equipos, órdenes y oportunidades del cliente, para ligar la muestra. */
export async function opcionesMuestra(
  cuentaId: string,
): Promise<OpcionesMuestra> {
  const supabase = await createClient();
  const [equipos, ordenes, oportunidades] = await Promise.all([
    supabase
      .from("equipos_cliente")
      .select("id, identificador, alias, plantas!inner (nombre, cuenta_id)")
      .eq("plantas.cuenta_id", cuentaId)
      .is("deleted_at", null)
      .order("identificador"),
    supabase
      .from("ordenes_servicio")
      .select("id, folio, estado, plantas (nombre)")
      .eq("cuenta_id", cuentaId)
      .neq("estado", "cancelada")
      .is("deleted_at", null)
      .order("fecha_programada", { ascending: false })
      .limit(50),
    supabase
      .from("oportunidades")
      .select("id, nombre")
      .eq("cuenta_id", cuentaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  // Las oportunidades pueden no ser visibles para el rol: entonces no se ofrecen.
  if (equipos.error || ordenes.error)
    throw new Error("No se pudieron cargar los datos del cliente.");
  return {
    equipos: equipos.data.map((e) => ({
      value: e.id,
      label: `${e.identificador}${e.alias ? ` (${e.alias})` : ""} · ${e.plantas.nombre}`,
    })),
    ordenes: ordenes.data.map((o) => ({
      value: o.id,
      label: `${o.folio}${o.plantas ? ` · ${o.plantas.nombre}` : ""}`,
    })),
    oportunidades: (oportunidades.data ?? []).map((o) => ({
      value: o.id,
      label: o.nombre,
    })),
  };
}

// Resultados ---------------------------------------------------------------------

const COLUMNAS_PARAMETRO =
  "id, clave, nombre, unidad, grupo, metodo, tipo_regla, limite_valor, limite_texto, activo, cuenta_para, en_basico, en_basico_mpc, en_extendido, en_premium";

/** Catálogo de parámetros de laboratorio, en el orden del informe. */
export async function listarParametrosLab(): Promise<ParametroLab[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parametros_laboratorio")
    .select(COLUMNAS_PARAMETRO)
    .order("orden")
    .order("nombre");
  if (error) throw new Error("No se pudieron cargar los parámetros.");
  return data;
}

/** Resultados capturados de una muestra: {parametro: texto}. */
export async function resultadosDeMuestra(
  muestraId: string,
): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("muestra_resultados")
    .select("parametro_id, valor_texto")
    .eq("muestra_id", muestraId);
  if (error) throw new Error("No se pudieron cargar los resultados.");
  return Object.fromEntries(data.map((r) => [r.parametro_id, r.valor_texto]));
}

// Evaluación ---------------------------------------------------------------------

/** Cuántos "no pasa" dan Precaución y cuántos Crítico (Parámetros de negocio). */
export async function umbralesCondicion(): Promise<Umbrales> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("umbrales_condicion_aceite");
  const u = data?.[0];
  if (error || !u || u.precaucion_desde === null || u.critico_desde === null)
    throw new Error("No se pudieron cargar los umbrales de condición.");
  return {
    precaucionDesde: u.precaucion_desde,
    criticoDesde: u.critico_desde,
  };
}

/**
 * Con qué se compara una muestra: la viscosidad nominal del aceite del equipo
 * y la muestra virgen más reciente de ese equipo que no sea posterior a ella.
 */
export async function contextoDeMuestra(m: Muestra): Promise<ContextoMuestra> {
  const nominal = m.equipos_cliente?.aceites?.viscosidad_nominal_40c ?? null;
  if (m.tipo === "virgen") return { esVirgen: true, nominal, base: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("muestras")
    .select("id, id_muestra")
    .eq("equipo_cliente_id", m.equipo_cliente_id)
    .eq("tipo", "virgen")
    .neq("estado", "cancelada")
    .lte("fecha_muestreo", m.fecha_muestreo)
    .is("deleted_at", null)
    .order("fecha_muestreo", { ascending: false })
    .order("id_muestra", { ascending: false })
    .limit(1);
  if (error) throw new Error("No se pudo cargar la muestra virgen.");
  const virgen = data[0];
  return {
    esVirgen: false,
    nominal,
    base: virgen
      ? {
          idMuestra: virgen.id_muestra,
          resultados: await resultadosDeMuestra(virgen.id),
        }
      : null,
  };
}
