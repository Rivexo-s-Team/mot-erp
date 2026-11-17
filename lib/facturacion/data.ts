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
