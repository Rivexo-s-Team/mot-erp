"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import {
  CAMPOS_COMPLEMENTO,
  esImporte,
  leerPago,
} from "@/lib/facturacion/pagos";
import { esquemaCampos, type Valores } from "@/lib/forms/campos";
import { createClient } from "@/lib/supabase/server";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

async function cliente() {
  return (await createClient()) as unknown as SupabaseClient;
}

function mensajeError(e: { code?: string; message?: string } | null): string {
  if (e?.code === "P0001" && e.message) return e.message;
  if (e?.code === "23505")
    return "Ese pago ya está aplicado a esa factura, o el complemento ya está en otro pago.";
  if (e?.code === "23514")
    return "Revisa el monto, la forma de pago y el tipo de cambio.";
  if (e?.code === "42501" || !e) return "Tu rol no puede registrar pagos.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar(id?: string) {
  revalidatePath("/pagos");
  // Los saldos de las facturas cambian con cada pago.
  revalidatePath("/facturas", "layout");
  if (id) revalidatePath(`/pagos/${id}`);
}

/**
 * Registra un pago y lo aplica a las facturas con monto en el formulario,
 * todo o nada. Si algo no procede vuelve a la pantalla con el motivo.
 */
export async function registrarPago(
  cuentaId: string,
  formulario: FormData,
): Promise<void> {
  await requirePermiso("facturacion.editar");
  if (!esId(cuentaId)) redirect("/pagos/nuevo");
  const volver = (motivo: string) =>
    redirect(
      `/pagos/nuevo?cuenta=${cuentaId}&error=${encodeURIComponent(motivo)}`,
    );
  const campos: Record<string, string> = {};
  for (const [k, v] of formulario.entries())
    if (typeof v === "string") campos[k] = v;
  const pago = leerPago(campos);
  if (!pago.ok) return volver(pago.error);

  const supabase = await createClient();
  const { razon_social, ...datos } = pago.datos;
  const { data, error } = await supabase.rpc("registrar_pago", {
    p_razon_social: razon_social,
    p_datos: datos,
    p_aplicaciones: pago.aplicaciones,
  });
  if (error || !data) return volver(mensajeError(error));
  refrescar(data);
  redirect(`/pagos/${data}`);
}

/** Aplica lo que le queda a un pago (o parte) a otra factura. */
export async function aplicarPago(
  pagoId: string,
  formulario: FormData,
): Promise<void> {
  await requirePermiso("facturacion.editar");
  if (!esId(pagoId)) redirect("/pagos");
  const factura = formulario.get("factura");
  const monto = String(formulario.get("monto") ?? "").trim();
  const volver = (motivo?: string) =>
    redirect(
      `/pagos/${pagoId}${motivo ? `?error=${encodeURIComponent(motivo)}` : ""}`,
    );
  if (!esId(factura)) return volver("Elige la factura.");
  if (!esImporte(monto))
    return volver("Escribe el monto a aplicar, por ejemplo 116.00.");

  const { error } = await (
    await cliente()
  )
    .from("pago_aplicaciones")
    .insert({ pago_id: pagoId, factura_id: factura, monto });
  refrescar(pagoId);
  return volver(error ? mensajeError(error) : undefined);
}

/** Quita la aplicación de un pago a una factura; la factura recupera su saldo. */
export async function quitarAplicacion(
  pagoId: string,
  aplicacionId: string,
): Promise<void> {
  await requirePermiso("facturacion.editar");
  if (!esId(pagoId) || !esId(aplicacionId)) return;
  await (
    await cliente()
  )
    .from("pago_aplicaciones")
    .delete()
    .eq("id", aplicacionId)
    .eq("pago_id", pagoId);
  refrescar(pagoId);
  redirect(`/pagos/${pagoId}`);
}

/** Registra el complemento de pago (REP) que se timbró fuera del sistema. */
export async function guardarComplemento(
  pagoId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(pagoId)) return { error: "Registro no válido." };
  const parsed = esquemaCampos(CAMPOS_COMPLEMENTO).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const { data, error } = await (
    await cliente()
  )
    .from("pagos")
    .update({
      rep_folio: parsed.data.rep_folio,
      rep_uuid: String(parsed.data.rep_uuid).toLowerCase(),
    })
    .eq("id", pagoId)
    .select("id");
  if (error || !data?.[0])
    return {
      error:
        error?.code === "23505"
          ? "Ese complemento ya está registrado en otro pago."
          : mensajeError(error),
    };
  refrescar(pagoId);
  redirect(`/pagos/${pagoId}`);
}

/** Elimina un pago capturado por error; sus facturas recuperan el saldo. */
export async function eliminarPago(pagoId: string): Promise<void> {
  await requirePermiso("facturacion.editar");
  if (!esId(pagoId)) return;
  const { error } = await (
    await cliente()
  )
    .from("pagos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", pagoId);
  refrescar(pagoId);
  if (error)
    redirect(
      `/pagos/${pagoId}?error=${encodeURIComponent(mensajeError(error))}`,
    );
  redirect("/pagos");
}
