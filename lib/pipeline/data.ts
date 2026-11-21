import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DIAS_CERRADAS_EN_TABLERO, ETAPAS_CERRADAS } from "./campos";

/** Lecturas del pipeline. RLS decide qué ve cada rol. */

/** Usuarios internos: nombre para mostrar y si pueden ser responsables. */
export async function directorioComercial() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("directorio_comercial");
  if (error) throw new Error("No se pudo cargar el directorio.");
  const nombres = new Map(data.map((d) => [d.id, d.nombre]));
  const asignables = data
    .filter((d) => d.asignable)
    .map((d) => ({ value: d.id, label: d.nombre }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  return { nombres, asignables };
}

const COLUMNAS =
  "id, nombre, etapa, tipo, origen, volumen_estimado_l, responsable_id, fecha_cierre, siguiente_paso, siguiente_paso_fecha, motivo_perdida, motivo_perdida_id, motivos_perdida (nombre), cuenta_id, planta_id, canal_venta_id, notas, updated_at, cuentas!inner (id, nombre, deleted_at), plantas (nombre), canales_venta (nombre)";

/**
 * Oportunidades para el tablero. `tablero`: las abiertas más las ganadas y
 * perdidas recientes (DIAS_CERRADAS_EN_TABLERO). `cerradas`: todas las
 * ganadas y perdidas.
 */
export async function listarOportunidades(
  vista: "tablero" | "cerradas",
  tipo?: string,
) {
  const supabase = await createClient();
  let query = supabase
    .from("oportunidades")
    .select(COLUMNAS)
    .is("deleted_at", null)
    .is("cuentas.deleted_at", null);
  if (vista === "cerradas") {
    query = query
      .in("etapa", ETAPAS_CERRADAS)
      .order("fecha_cierre", { ascending: false });
  } else {
    const desde = new Date(
      Date.now() - DIAS_CERRADAS_EN_TABLERO * 86_400_000,
    ).toISOString();
    query = query
      .or(
        `etapa.not.in.(${ETAPAS_CERRADAS.join(",")}),fecha_cierre.gte.${desde}`,
      )
      .order("updated_at", { ascending: false });
  }
  if (tipo) query = query.eq("tipo", tipo);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las oportunidades.");
  return data;
}

export async function oportunidadesDeCuenta(cuentaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("oportunidades")
    .select("id, nombre, etapa, plantas (nombre)")
    .eq("cuenta_id", cuentaId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las oportunidades.");
  return data;
}

export async function obtenerOportunidad(id: string) {
  const supabase = await createClient();
  const [oportunidad, actividades, adjuntos] = await Promise.all([
    supabase
      .from("oportunidades")
      .select(COLUMNAS)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("actividades_comerciales")
      .select("id, tipo, fecha, responsable_id, notas")
      .eq("oportunidad_id", id)
      .is("deleted_at", null)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("oportunidad_adjuntos")
      .select("id, nombre, tipo_mime, tamano_bytes, etapa, created_at")
      .eq("oportunidad_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (oportunidad.error || actividades.error || adjuntos.error) {
    throw new Error("No se pudo cargar la oportunidad.");
  }
  if (!oportunidad.data || oportunidad.data.cuentas.deleted_at !== null)
    return null;
  return {
    ...oportunidad.data,
    actividades: actividades.data,
    adjuntos: adjuntos.data,
  };
}

export type Oportunidad = Awaited<
  ReturnType<typeof listarOportunidades>
>[number];

export async function listarCanalesActivos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("canales_venta")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error("No se pudieron cargar los canales de venta.");
  return data.map((c) => ({ value: c.id, label: c.nombre }));
}

/** Cuentas vigentes, para elegir a cuál pertenece una oportunidad nueva. */
export async function listarCuentasParaElegir() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, nombre")
    .is("deleted_at", null)
    .order("nombre");
  if (error) throw new Error("No se pudieron cargar los clientes.");
  return data;
}

export async function plantasDeCuenta(cuentaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plantas")
    .select("id, nombre")
    .eq("cuenta_id", cuentaId)
    .is("deleted_at", null)
    .order("nombre");
  if (error) throw new Error("No se pudieron cargar las plantas.");
  return data.map((p) => ({ value: p.id, label: p.nombre }));
}

export async function listarMotivosPerdida() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("motivos_perdida")
    .select("id, nombre")
    .eq("activo", true)
    .order("orden")
    .order("nombre");
  if (error) throw new Error("No se pudieron cargar los motivos de pérdida.");
  return data.map((m) => ({ value: m.id, label: m.nombre }));
}
