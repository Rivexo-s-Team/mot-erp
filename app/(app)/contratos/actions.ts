"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import {
  camposContrato,
  camposTarifa,
  partidasATarifas,
  validarContrato,
} from "@/lib/contratos/campos";
import { cotizacionAceptada, obtenerContrato } from "@/lib/contratos/data";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { obtenerOportunidad } from "@/lib/pipeline/data";
import { createClient } from "@/lib/supabase/server";

const PERMISO = "contratos.editar";
const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** Las tablas se nombran aquí, nunca con datos del usuario; RLS decide el acceso. */
async function tabla(nombre: "contratos" | "contrato_tarifas") {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from(nombre);
}

function mensajeError(code: string | undefined): string {
  if (code === "23505") return "Esa oportunidad ya tiene un contrato.";
  if (code === "23503")
    return "Uno de los datos elegidos no pertenece a este cliente o a esta planta.";
  if (code === "23514") return "Revisa las fechas y los importes.";
  if (code === "42501") return "Tu rol no puede hacer este cambio.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

/**
 * Crea (id = null, con su cuenta) o edita un contrato. Si se crea desde una
 * oportunidad ganada, queda ligado a ella y a su cotización aceptada, y las
 * partidas de esa cotización se copian como tarifas iniciales.
 */
export async function guardarContrato(
  cuentaId: string,
  id: string | null,
  oportunidadId: string | null,
  valores: Valores,
): Promise<ActionResult> {
  const sesion = await requirePermiso(PERMISO);
  if (
    !esId(cuentaId) ||
    (id !== null && !esId(id)) ||
    (oportunidadId !== null && !esId(oportunidadId))
  )
    return { error: "Registro no válido." };

  const campos = camposContrato([], [], []);
  const parsed = esquemaCampos(campos, validarContrato).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  if (id !== null && parsed.data.contrato_origen_id === id)
    return { error: "Un contrato no puede ser ampliación de sí mismo." };
  const fila = aFila(campos, parsed.data, id !== null);
  const t = await tabla("contratos");

  if (id !== null) {
    const { data, error } = await t
      .update(fila)
      .eq("id", id)
      .eq("cuenta_id", cuentaId)
      .select("id");
    if (error || !data?.[0])
      return { error: mensajeError(error?.code ?? "42501") };
    revalidatePath("/contratos");
    revalidatePath(`/contratos/${id}`);
    redirect(`/contratos/${id}`);
  }

  // Alta. La oportunidad y la cotización se leen con la sesión: si el rol no
  // las puede ver, el contrato no se liga a ellas.
  let cotizacion: Awaited<ReturnType<typeof cotizacionAceptada>> = null;
  if (oportunidadId !== null) {
    if (!tienePermiso(sesion, "oportunidades.ver"))
      return {
        error: "Tu rol no puede crear contratos desde una oportunidad.",
      };
    const oportunidad = await obtenerOportunidad(oportunidadId);
    if (
      !oportunidad ||
      oportunidad.cuenta_id !== cuentaId ||
      oportunidad.etapa !== "ganada"
    )
      return {
        error: "La oportunidad debe estar ganada y ser de este cliente.",
      };
    if (tienePermiso(sesion, "precios.ver"))
      cotizacion = await cotizacionAceptada(oportunidadId);
  }

  const { data, error } = await t
    .insert({
      ...fila,
      cuenta_id: cuentaId,
      oportunidad_id: oportunidadId,
      cotizacion_id: cotizacion?.id ?? null,
    })
    .select("id, planta_id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };
  const contrato = data[0] as { id: string; planta_id: string };

  let aviso = "";
  if (cotizacion && cotizacion.partidas.length > 0) {
    const tarifas = partidasATarifas(
      cotizacion.partidas,
      contrato.planta_id,
    ).map((tarifa) => ({
      ...tarifa,
      contrato_id: contrato.id,
      planta_id: contrato.planta_id,
    }));
    const copia = await (await tabla("contrato_tarifas")).insert(tarifas);
    // El contrato ya existe: se avisa en su ficha para capturarlas a mano.
    if (copia.error) aviso = "?aviso=tarifas";
  }

  revalidatePath("/contratos");
  if (oportunidadId) revalidatePath(`/oportunidades/${oportunidadId}`);
  redirect(`/contratos/${contrato.id}${aviso}`);
}

export async function eliminarContrato(id: string): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(id)) return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla("contratos")
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, oportunidad_id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  const oportunidadId = (data[0] as { oportunidad_id: string | null })
    .oportunidad_id;
  if (oportunidadId) revalidatePath(`/oportunidades/${oportunidadId}`);
  revalidatePath("/contratos");
  redirect("/contratos");
}

/** Las tarifas son precios: además de editar contratos hay que poder verlos. */
async function requireTarifas() {
  const sesion = await requirePermiso(PERMISO);
  if (!tienePermiso(sesion, "precios.ver")) redirect("/contratos");
}

export async function guardarTarifa(
  contratoId: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requireTarifas();
  if (!esId(contratoId) || (id !== null && !esId(id)))
    return { error: "Registro no válido." };
  const contrato = await obtenerContrato(contratoId);
  if (!contrato) return { error: "El contrato ya no existe." };

  const campos = camposTarifa([], contrato.moneda);
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const fila = aFila(campos, parsed.data, id !== null);
  const t = await tabla("contrato_tarifas");
  const { data, error } = id
    ? await t
        .update(fila)
        .eq("id", id)
        .eq("contrato_id", contratoId)
        .select("id")
    : await t
        .insert({
          ...fila,
          contrato_id: contratoId,
          planta_id: contrato.planta_id,
        })
        .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath("/contratos");
  revalidatePath(`/contratos/${contratoId}`);
  redirect(`/contratos/${contratoId}`);
}

export async function eliminarTarifa(
  contratoId: string,
  id: string,
): Promise<ActionResult> {
  await requireTarifas();
  if (!esId(contratoId) || !esId(id)) return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla("contrato_tarifas")
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("contrato_id", contratoId)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath("/contratos");
  revalidatePath(`/contratos/${contratoId}`);
  redirect(`/contratos/${contratoId}`);
}
