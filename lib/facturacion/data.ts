import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Lecturas de facturación. RLS: quien tiene facturacion.ver. */

const COLUMNAS_CREDITO =
  "razon_social_id, cuenta_id, dias_credito, requiere_orden_compra, metodo_pago, forma_pago, contacto_cxp_id, portal, notas, contactos (nombre)";

/** Condiciones de crédito de las razones sociales de una cuenta, por razón social. */
export async function creditoDeCuenta(cuentaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("condiciones_credito")
    .select(COLUMNAS_CREDITO)
    .eq("cuenta_id", cuentaId);
  if (error)
    throw new Error("No se pudieron cargar las condiciones de crédito.");
  return new Map(data.map((c) => [c.razon_social_id, c]));
}

export type CondicionesCredito =
  Awaited<ReturnType<typeof creditoDeCuenta>> extends Map<string, infer C>
    ? C
    : never;

/** La razón social (vigente) de una cuenta, con sus contactos para elegir. */
export async function razonSocialParaCredito(
  cuentaId: string,
  razonId: string,
) {
  const supabase = await createClient();
  const [razon, contactos] = await Promise.all([
    supabase
      .from("razones_sociales")
      .select("id, razon_social, rfc, cuentas!inner (nombre)")
      .eq("id", razonId)
      .eq("cuenta_id", cuentaId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("contactos")
      .select("id, nombre, area")
      .eq("cuenta_id", cuentaId)
      .is("deleted_at", null)
      .order("nombre"),
  ]);
  if (razon.error || contactos.error)
    throw new Error("No se pudo cargar la razón social.");
  if (!razon.data) return null;
  return {
    ...razon.data,
    // Primero los de cuentas por pagar.
    contactos: [...contactos.data]
      .sort(
        (a, b) =>
          Number(b.area === "cuentas_por_pagar") -
          Number(a.area === "cuentas_por_pagar"),
      )
      .map((c) => ({ value: c.id, label: c.nombre })),
  };
}

// Facturas -----------------------------------------------------------------------

const COLUMNAS_FACTURA =
  "id, cuenta_id, razon_social_id, estado, fecha, moneda, tipo_cambio, metodo_pago, forma_pago, uso_cfdi, orden_compra, dias_credito, notas, es_anticipo, serie, folio, uuid_fiscal, timbrado, emitida_at, emitida_por, xml_ruta, pdf_ruta, xml_total, cancelada_at, cancelada_por, motivo_cancelacion, created_at, cuentas (nombre), razones_sociales (razon_social, rfc, regimen_fiscal, codigo_postal_fiscal)";

export async function listarFacturas(filtro: { estado?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("facturas")
    .select(COLUMNAS_FACTURA)
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (filtro.estado) query = query.eq("estado", filtro.estado);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las facturas.");
  return conTotales(data);
}

type Totales = {
  subtotal: number;
  iva: number;
  total: number;
  conceptos: number;
};

/**
 * Agrega a cada factura sus totales (vista `factura_totales`). Se consulta
 * aparte: la vista no se puede traer anidada en la misma consulta.
 */
async function conTotales<T extends { id: string }>(
  facturas: T[],
): Promise<(T & { factura_totales: Totales | null })[]> {
  if (facturas.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("factura_totales")
    .select("factura_id, subtotal, iva, total, conceptos")
    .in(
      "factura_id",
      facturas.map((f) => f.id),
    );
  if (error) throw new Error("No se pudieron cargar los totales.");
  const porFactura = new Map(
    data.map((t) => [
      t.factura_id,
      {
        subtotal: t.subtotal ?? 0,
        iva: t.iva ?? 0,
        total: t.total ?? 0,
        conceptos: t.conceptos ?? 0,
      },
    ]),
  );
  return facturas.map((f) => ({
    ...f,
    factura_totales: porFactura.get(f.id) ?? null,
  }));
}

export type Factura = Awaited<ReturnType<typeof listarFacturas>>[number];

export async function obtenerFactura(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select(COLUMNAS_FACTURA)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la factura.");
  return data ? ((await conTotales([data]))[0] ?? null) : null;
}

export async function conceptosDeFactura(facturaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("factura_conceptos")
    .select(
      "id, cargo_id, orden, descripcion, cantidad, unidad, precio_unitario, importe, iva_tasa, iva, clave_prod_serv, clave_unidad",
    )
    .eq("factura_id", facturaId)
    .order("orden")
    .order("created_at");
  if (error) throw new Error("No se pudieron cargar los conceptos.");
  return data;
}

export type ConceptoFactura = Awaited<
  ReturnType<typeof conceptosDeFactura>
>[number];

/**
 * Cargos que se pueden facturar: pendientes, completos y que no estén ya en
 * otra factura. De un cliente, o de todos (para saber quién tiene algo por facturar).
 */
export async function cargosFacturables(cuentaId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("cargos")
    .select(
      "id, cuenta_id, concepto, cantidad, unidad, precio_unitario, importe, moneda, tipo, periodo, created_at, cuentas (nombre)",
    )
    .eq("estado", "pendiente")
    .is("factura_id", null)
    .is("deleted_at", null)
    .not("importe", "is", null)
    // Las rentas por mes; lo demás, por antigüedad.
    .order("periodo")
    .order("created_at")
    .order("concepto");
  if (cuentaId) query = query.eq("cuenta_id", cuentaId);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar los cargos.");
  return data;
}

/** Razones sociales vigentes de una cuenta, para elegir a cuál se factura. */
export async function razonesParaFacturar(cuentaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("razones_sociales")
    .select("id, razon_social, rfc")
    .eq("cuenta_id", cuentaId)
    .is("deleted_at", null)
    .order("razon_social");
  if (error) throw new Error("No se pudieron cargar las razones sociales.");
  return data;
}

// Pagos --------------------------------------------------------------------------

export type SaldoFactura = { total: number; pagado: number; saldo: number };

/** Total, pagado y saldo de varias facturas (vista `factura_saldos`). */
export async function saldosDeFacturas(
  ids: string[],
): Promise<Map<string, SaldoFactura>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("factura_saldos")
    .select("factura_id, total, pagado, saldo")
    .in("factura_id", ids);
  if (error) throw new Error("No se pudieron cargar los saldos.");
  return new Map(
    data.map((s) => [
      s.factura_id ?? "",
      { total: s.total ?? 0, pagado: s.pagado ?? 0, saldo: s.saldo ?? 0 },
    ]),
  );
}

/**
 * Facturas emitidas con saldo: las que se pueden pagar. De un cliente, o de
 * todos (para saber quién debe algo).
 */
export async function facturasPorCobrar(cuentaId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("facturas")
    .select(
      "id, cuenta_id, razon_social_id, fecha, moneda, serie, folio, dias_credito, metodo_pago, cuentas (nombre), razones_sociales (razon_social, rfc, usa_portal_proveedores)",
    )
    .eq("estado", "emitida")
    .is("deleted_at", null)
    .order("fecha")
    .order("folio");
  if (cuentaId) query = query.eq("cuenta_id", cuentaId);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las facturas.");
  const saldos = await saldosDeFacturas(data.map((f) => f.id));
  return data
    .map((f) => ({
      ...f,
      saldos: saldos.get(f.id) ?? { total: 0, pagado: 0, saldo: 0 },
    }))
    .filter((f) => f.saldos.saldo > 0);
}

const COLUMNAS_PAGO =
  "id, cuenta_id, razon_social_id, fecha, monto, moneda, tipo_cambio, forma_pago, referencia, notas, rep_folio, rep_uuid, anticipo_factura_id, created_at, created_by, cuentas (nombre), razones_sociales (razon_social, rfc)";

type SaldoPago = { aplicado: number; por_aplicar: number };

async function conSaldoDePago<T extends { id: string; monto: number }>(
  pagos: T[],
): Promise<(T & { saldos: SaldoPago })[]> {
  if (pagos.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pago_saldos")
    .select("pago_id, aplicado, por_aplicar")
    .in(
      "pago_id",
      pagos.map((p) => p.id),
    );
  if (error) throw new Error("No se pudieron cargar los pagos.");
  const porPago = new Map(
    data.map((s) => [
      s.pago_id,
      { aplicado: s.aplicado ?? 0, por_aplicar: s.por_aplicar ?? 0 },
    ]),
  );
  return pagos.map((p) => ({
    ...p,
    saldos: porPago.get(p.id) ?? { aplicado: 0, por_aplicar: p.monto },
  }));
}

export async function listarPagos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos")
    .select(COLUMNAS_PAGO)
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar los pagos.");
  return conSaldoDePago(data);
}

export type Pago = Awaited<ReturnType<typeof listarPagos>>[number];

export async function obtenerPago(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos")
    .select(COLUMNAS_PAGO)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el pago.");
  return data ? ((await conSaldoDePago([data]))[0] ?? null) : null;
}

/** A qué facturas se aplicó un pago. */
export async function aplicacionesDePago(pagoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pago_aplicaciones")
    .select(
      "id, factura_id, monto, facturas (serie, folio, fecha, metodo_pago, moneda)",
    )
    .eq("pago_id", pagoId)
    .order("created_at");
  if (error) throw new Error("No se pudieron cargar las aplicaciones.");
  return data;
}

/** Qué pagos se le han aplicado a una factura. */
export async function pagosDeFactura(facturaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pago_aplicaciones")
    .select(
      "id, pago_id, monto, pagos (fecha, forma_pago, referencia, rep_folio)",
    )
    .eq("factura_id", facturaId)
    .order("created_at");
  if (error) throw new Error("No se pudieron cargar los pagos de la factura.");
  return data;
}

// Anticipos ----------------------------------------------------------------------

export type SaldoAnticipo = {
  factura_id: string;
  serie: string | null;
  folio: string | null;
  pagado: number;
  aplicado: number;
  disponible: number;
};

/**
 * Facturas de anticipo emitidas de una razón social en una moneda, con lo que
 * el cliente pagó, lo ya aplicado y lo disponible.
 */
export async function anticiposDeRazon(
  razonSocialId: string,
  moneda: string,
): Promise<SaldoAnticipo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anticipo_saldos")
    .select("factura_id, pagado, aplicado, disponible")
    .eq("razon_social_id", razonSocialId)
    .eq("moneda", moneda);
  if (error) throw new Error("No se pudieron cargar los anticipos.");
  const ids = data.flatMap((a) => (a.factura_id ? [a.factura_id] : []));
  if (ids.length === 0) return [];
  const folios = await supabase
    .from("facturas")
    .select("id, serie, folio")
    .in("id", ids);
  if (folios.error) throw new Error("No se pudieron cargar los anticipos.");
  const porId = new Map(folios.data.map((f) => [f.id, f]));
  return data.flatMap((a) =>
    a.factura_id
      ? [
          {
            factura_id: a.factura_id,
            serie: porId.get(a.factura_id)?.serie ?? null,
            folio: porId.get(a.factura_id)?.folio ?? null,
            pagado: a.pagado ?? 0,
            aplicado: a.aplicado ?? 0,
            disponible: a.disponible ?? 0,
          },
        ]
      : [],
  );
}

/** A qué facturas se ha aplicado un anticipo. */
export async function aplicacionesDeAnticipo(anticipoFacturaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos")
    .select(
      "id, fecha, monto, rep_folio, pago_aplicaciones (factura_id, facturas (serie, folio))",
    )
    .eq("anticipo_factura_id", anticipoFacturaId)
    .is("deleted_at", null)
    .order("fecha");
  if (error) throw new Error("No se pudieron cargar las aplicaciones.");
  return data;
}

// Cobranza -------------------------------------------------------------------------

const COLUMNAS_PORTAL =
  "factura_id, estado, fecha_subida, fecha_aprobacion, fecha_pago_programado, notas, updated_at";

/** Seguimiento en el portal de proveedores de varias facturas, por factura. */
export async function portalDeFacturas(ids: string[]) {
  if (ids.length === 0) return new Map<string, SeguimientoPortal>();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portal_proveedor")
    .select(COLUMNAS_PORTAL)
    .in("factura_id", ids);
  if (error) throw new Error("No se pudo cargar el seguimiento de portales.");
  return new Map(data.map((p) => [p.factura_id, p]));
}

export type SeguimientoPortal = {
  factura_id: string;
  estado: string;
  fecha_subida: string | null;
  fecha_aprobacion: string | null;
  fecha_pago_programado: string | null;
  notas: string | null;
  updated_at: string;
};

/** ¿La razón social pide subir sus facturas a un portal? Y cuál. */
export async function portalDeRazon(razonSocialId: string) {
  const supabase = await createClient();
  const [{ data: razon }, { data: credito }] = await Promise.all([
    supabase
      .from("razones_sociales")
      .select("usa_portal_proveedores")
      .eq("id", razonSocialId)
      .maybeSingle(),
    supabase
      .from("condiciones_credito")
      .select("portal")
      .eq("razon_social_id", razonSocialId)
      .maybeSingle(),
  ]);
  return {
    usa: razon?.usa_portal_proveedores ?? false,
    portal: credito?.portal ?? null,
  };
}

/** Monto, facturado y saldo de las órdenes de compra de un contrato. */
export async function saldosDeOrdenes(contratoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orden_compra_saldos")
    .select("orden_compra_id, monto, facturado, saldo")
    .eq("contrato_id", contratoId);
  if (error)
    throw new Error("No se pudieron cargar los saldos de las órdenes.");
  return new Map(
    data.map((o) => [
      o.orden_compra_id ?? "",
      { monto: o.monto, facturado: o.facturado ?? 0, saldo: o.saldo },
    ]),
  );
}
