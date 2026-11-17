"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { obtenerFactura } from "@/lib/facturacion/data";
import {
  accionesFactura,
  CAMPOS_CONCEPTO,
  camposFactura,
  validarFactura,
} from "@/lib/facturacion/facturas";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

async function cliente() {
  return (await createClient()) as unknown as SupabaseClient;
}

function mensajeError(e: { code?: string; message?: string } | null): string {
  if (e?.code === "P0001" && e.message) return e.message;
  if (e?.code === "23514")
    return "Revisa la forma de pago y el tipo de cambio.";
  if (e?.code === "42501" || !e) return "Tu rol no puede cambiar facturas.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar(id?: string) {
  revalidatePath("/facturas");
  revalidatePath("/cargos");
  if (id) revalidatePath(`/facturas/${id}`);
}

/**
 * Arma una factura en borrador con los cargos marcados en el formulario
 * (campos `razon_social` y `cargo`). Si algo no procede vuelve a la pantalla
 * con el motivo.
 */
export async function crearFactura(
  cuentaId: string,
  datos: FormData,
): Promise<void> {
  await requirePermiso("facturacion.editar");
  const volver = (motivo: string) =>
    redirect(
      `/facturas/nueva?cuenta=${cuentaId}&error=${encodeURIComponent(motivo)}`,
    );
  if (!esId(cuentaId)) redirect("/facturas/nueva");
  const razon = datos.get("razon_social");
  const cargos = datos.getAll("cargo").filter(esId);
  if (!esId(razon)) return volver("Elige la razón social a la que se factura.");
  if (cargos.length === 0) return volver("Marca al menos un cargo.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_factura", {
    p_razon_social: razon,
    p_cargos: cargos,
  });
  if (error || !data) return volver(mensajeError(error));
  refrescar(data);
  redirect(`/facturas/${data}`);
}

/** Corrige el encabezado de una factura en borrador. */
export async function guardarFactura(
  id: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(id)) return { error: "Registro no válido." };
  const factura = await obtenerFactura(id);
  if (!factura) return { error: "La factura ya no existe." };
  if (!accionesFactura(factura.estado).editar)
    return { error: "La factura ya no es un borrador." };

  const campos = camposFactura(factura.moneda, hoyEnMexico());
  const parsed = esquemaCampos(campos, validarFactura).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const { data, error } = await (
    await cliente()
  )
    .from("facturas")
    .update(aFila(campos, parsed.data, true))
    .eq("id", id)
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(id);
  redirect(`/facturas/${id}`);
}

/** Corrige la descripción y las claves del SAT de un concepto. */
export async function guardarConcepto(
  facturaId: string,
  conceptoId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(facturaId) || !esId(conceptoId))
    return { error: "Registro no válido." };
  const parsed = esquemaCampos(CAMPOS_CONCEPTO).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const { data, error } = await (
    await cliente()
  )
    .from("factura_conceptos")
    .update(aFila(CAMPOS_CONCEPTO, parsed.data, true))
    .eq("id", conceptoId)
    .eq("factura_id", facturaId)
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(facturaId);
  redirect(`/facturas/${facturaId}`);
}

/** Quita un concepto del borrador; su cargo vuelve a quedar por facturar. */
export async function quitarConcepto(
  facturaId: string,
  conceptoId: string,
): Promise<void> {
  await requirePermiso("facturacion.editar");
  if (!esId(facturaId) || !esId(conceptoId)) return;
  await (
    await cliente()
  )
    .from("factura_conceptos")
    .delete()
    .eq("id", conceptoId)
    .eq("factura_id", facturaId);
  refrescar(facturaId);
  redirect(`/facturas/${facturaId}`);
}

/** Elimina un borrador; sus cargos vuelven a quedar por facturar. */
export async function eliminarFactura(id: string): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(id)) return { error: "Registro no válido." };
  const { data, error } = await (
    await cliente()
  )
    .from("facturas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(id);
  redirect("/facturas");
}
