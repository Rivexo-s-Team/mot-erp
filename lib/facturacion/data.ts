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
  "id, cuenta_id, razon_social_id, estado, fecha, moneda, tipo_cambio, metodo_pago, forma_pago, uso_cfdi, orden_compra, dias_credito, notas, created_at, cuentas (nombre), razones_sociales (razon_social, rfc, regimen_fiscal, codigo_postal_fiscal)";

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
      "id, cuenta_id, concepto, cantidad, unidad, precio_unitario, importe, moneda, tipo, created_at, cuentas (nombre)",
    )
    .eq("estado", "pendiente")
    .is("factura_id", null)
    .is("deleted_at", null)
    .not("importe", "is", null)
    .order("created_at");
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
