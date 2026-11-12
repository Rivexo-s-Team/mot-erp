import "server-only";
import { direccionPlanta } from "@/lib/clientes/campos";
import { createClient } from "@/lib/supabase/server";
import type { ParametrosCotizador } from "./cotizador";

/** Lecturas de cotizaciones. RLS solo las entrega a quien ve el pipeline y los precios. */

/** Porcentaje y piso del cotizador, leídos de parametros_negocio. Null si el rol no los ve. */
export async function parametrosCotizador(): Promise<ParametrosCotizador | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parametros_negocio")
    .select("clave, valor, moneda")
    .in("clave", [
      "cotizador_porcentaje_aceite_nuevo",
      "cotizador_piso_precio_litro",
    ]);
  if (error)
    throw new Error("No se pudieron cargar los parámetros del cotizador.");
  const porcentaje = data.find(
    (p) => p.clave === "cotizador_porcentaje_aceite_nuevo",
  );
  const piso = data.find((p) => p.clave === "cotizador_piso_precio_litro");
  if (!porcentaje || !piso?.moneda) return null;
  return {
    porcentaje: porcentaje.valor,
    piso: piso.valor,
    monedaPiso: piso.moneda,
  };
}

export async function cotizacionesDeOportunidad(oportunidadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, folio, version, estado, moneda, vigencia, created_at")
    .eq("oportunidad_id", oportunidadId)
    .is("deleted_at", null)
    .order("version", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las cotizaciones.");
  const totales = await totalesDe(data.map((c) => c.id));
  return data.map((c) => ({ ...c, totales: totales.get(c.id) ?? SIN_TOTALES }));
}

const SIN_TOTALES = { total_unico: 0, total_recurrente: 0, partidas: 0 };

async function totalesDe(ids: string[]) {
  const mapa = new Map<string, typeof SIN_TOTALES>();
  if (ids.length === 0) return mapa;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cotizacion_totales")
    .select("cotizacion_id, total_unico, total_recurrente, partidas")
    .in("cotizacion_id", ids);
  if (error) throw new Error("No se pudieron cargar los totales.");
  for (const t of data) {
    if (t.cotizacion_id) {
      mapa.set(t.cotizacion_id, {
        total_unico: t.total_unico ?? 0,
        total_recurrente: t.total_recurrente ?? 0,
        partidas: t.partidas ?? 0,
      });
    }
  }
  return mapa;
}

export async function obtenerCotizacion(
  oportunidadId: string,
  cotizacionId: string,
) {
  const supabase = await createClient();
  const [cotizacion, lineas] = await Promise.all([
    supabase
      .from("cotizaciones")
      .select(
        "id, folio, version, estado, moneda, tipo_cambio, vigencia, valor_total_contrato, litros_estimados, condiciones, notas, created_at, contacto_id, numero_requisicion, condiciones_pago, contactos (nombre, telefono_celular, telefono_oficina, correo)",
      )
      .eq("id", cotizacionId)
      .eq("oportunidad_id", oportunidadId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("cotizacion_lineas")
      .select(
        "id, orden, concepto, equipo_cliente_id, cantidad, unidad, precio_unitario, recurrente, numero_parte_cliente, referencia_costo_contenedor, referencia_litros_contenedor, precio_referencia, fuente_tipo, fuente_url, fecha_referencia, fuente_archivo_ruta, fuente_archivo_nombre, importe, equipos_cliente (identificador, alias)",
      )
      .eq("cotizacion_id", cotizacionId)
      .is("deleted_at", null)
      .order("orden")
      .order("created_at"),
  ]);
  if (cotizacion.error || lineas.error)
    throw new Error("No se pudo cargar la cotización.");
  if (!cotizacion.data) return null;
  const totales =
    (await totalesDe([cotizacionId])).get(cotizacionId) ?? SIN_TOTALES;
  return { ...cotizacion.data, lineas: lineas.data, totales };
}

export type Cotizacion = NonNullable<
  Awaited<ReturnType<typeof obtenerCotizacion>>
>;

/** Equipos que se pueden ligar a una partida: los de la planta, o los de toda la cuenta. */
export async function equiposParaCotizar(
  cuentaId: string,
  plantaId: string | null,
) {
  const supabase = await createClient();
  let query = supabase
    .from("equipos_cliente")
    .select(
      "id, identificador, alias, plantas!inner (nombre, cuenta_id, deleted_at)",
    )
    .eq("plantas.cuenta_id", cuentaId)
    .is("plantas.deleted_at", null)
    .is("deleted_at", null)
    .order("identificador");
  if (plantaId) query = query.eq("planta_id", plantaId);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar los equipos.");
  return data.map((e) => ({
    value: e.id,
    label: `${e.identificador}${e.alias ? ` (${e.alias})` : ""} · ${e.plantas.nombre}`,
  }));
}

/** Personas del cliente a quienes puede dirigirse una cotización. */
export async function contactosDeCuenta(cuentaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .select("id, nombre, puesto")
    .eq("cuenta_id", cuentaId)
    .is("deleted_at", null)
    .order("nombre");
  if (error) throw new Error("No se pudieron cargar los contactos.");
  return data.map((c) => ({
    value: c.id,
    label: c.puesto ? `${c.nombre} (${c.puesto})` : c.nombre,
  }));
}

/** Días de vigencia que se proponen al crear una cotización; null si el rol no ve parámetros. */
export async function vigenciaPorDefectoDias(): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parametros_negocio")
    .select("valor")
    .eq("clave", "cotizacion_vigencia_dias")
    .maybeSingle();
  return data ? data.valor : null;
}

/** Dirección de una planta en una línea, para el PDF. Null si no está capturada. */
export async function direccionDePlanta(
  plantaId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plantas")
    .select(
      "calle, numero_exterior, numero_interior, colonia, municipio, estado, codigo_postal",
    )
    .eq("id", plantaId)
    .maybeSingle();
  return data ? direccionPlanta(data) || null : null;
}
