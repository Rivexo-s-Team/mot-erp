"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { obtenerContrato } from "@/lib/contratos/data";
import {
  camposAsignacion,
  camposCarrusel,
  camposMovimiento,
  problemaMovimiento,
  validarAsignacion,
} from "@/lib/flota/campos";
import {
  asignacionesDeRobox,
  carruselDeAsignacion,
  movimientosDeAsignacion,
  ubicaciones,
} from "@/lib/flota/data";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { createClient } from "@/lib/supabase/server";

const PERMISO = "flota.editar";
const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** Las tablas se nombran aquí, nunca con datos del usuario; RLS decide el acceso. */
async function tabla(
  nombre: "asignaciones_robox" | "carrusel_equipos" | "movimientos_robox",
) {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from(nombre);
}

function mensajeError(code: string | undefined): string {
  if (code === "23P01")
    return "Ese Robox ya está asignado a otro contrato en esas fechas.";
  if (code === "P0001")
    return "Ese Robox está dado de baja; no se puede asignar.";
  if (code === "23505") return "Ese equipo ya está en el carrusel.";
  if (code === "23503")
    return "Uno de los datos elegidos no pertenece a la planta de la asignación.";
  if (code === "23514") return "Revisa las fechas.";
  if (code === "42501") return "Tu rol no puede hacer este cambio.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar(roboxId: string, contratoId?: string) {
  revalidatePath("/flota");
  revalidatePath(`/flota/${roboxId}`);
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
}

/** La asignación del Robox (con la sesión de quien consulta), o undefined. */
async function buscarAsignacion(roboxId: string, asignacionId: string) {
  return (await asignacionesDeRobox(roboxId)).find(
    (a) => a.id === asignacionId,
  );
}

/** Asigna un Robox a un contrato; queda en la planta de ese contrato. */
export async function asignarRobox(
  roboxId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(roboxId)) return { error: "Registro no válido." };
  const campos = camposAsignacion([], "", false);
  const parsed = esquemaCampos(campos, validarAsignacion).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const contrato = await obtenerContrato(String(parsed.data.contrato_id));
  if (!contrato || !["borrador", "vigente"].includes(contrato.estado))
    return { error: "Elige un contrato en borrador o vigente." };

  const { data, error } = await (
    await tabla("asignaciones_robox")
  )
    .insert({
      ...aFila(campos, parsed.data, false),
      robox_id: roboxId,
      planta_id: contrato.planta_id,
    })
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(roboxId, contrato.id);
  redirect(`/flota/${roboxId}`);
}

/** Cambia las fechas o notas de una asignación. Con fecha de término, se da por terminada. */
export async function guardarAsignacion(
  roboxId: string,
  asignacionId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(roboxId) || !esId(asignacionId))
    return { error: "Registro no válido." };
  const campos = camposAsignacion([], "", true);
  const parsed = esquemaCampos(campos, validarAsignacion).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const { data, error } = await (
    await tabla("asignaciones_robox")
  )
    .update(aFila(campos, parsed.data, true))
    .eq("id", asignacionId)
    .eq("robox_id", roboxId)
    .select("contrato_id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(roboxId, (data[0] as { contrato_id: string }).contrato_id);
  redirect(`/flota/${roboxId}`);
}

/** Quita una asignación capturada por error. */
export async function eliminarAsignacion(
  roboxId: string,
  asignacionId: string,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(roboxId) || !esId(asignacionId))
    return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla("asignaciones_robox")
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", asignacionId)
    .eq("robox_id", roboxId)
    .select("contrato_id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(roboxId, (data[0] as { contrato_id: string }).contrato_id);
  redirect(`/flota/${roboxId}`);
}

export async function guardarCarrusel(
  roboxId: string,
  asignacionId: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(roboxId) || !esId(asignacionId) || (id !== null && !esId(id)))
    return { error: "Registro no válido." };
  const asignacion = await buscarAsignacion(roboxId, asignacionId);
  if (!asignacion) return { error: "La asignación ya no existe." };

  const campos = camposCarrusel([]);
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const fila = aFila(campos, parsed.data, id !== null);
  const t = await tabla("carrusel_equipos");
  const { data, error } = id
    ? await t
        .update(fila)
        .eq("id", id)
        .eq("asignacion_id", asignacionId)
        .select("id")
    : await t
        .insert({
          ...fila,
          asignacion_id: asignacionId,
          planta_id: asignacion.planta_id,
        })
        .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(roboxId, asignacion.contrato_id);
  redirect(`/flota/${roboxId}`);
}

export async function quitarDelCarrusel(
  roboxId: string,
  asignacionId: string,
  id: string,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(roboxId) || !esId(asignacionId) || !esId(id))
    return { error: "Registro no válido." };
  const asignacion = await buscarAsignacion(roboxId, asignacionId);
  if (!asignacion) return { error: "La asignación ya no existe." };

  const { data, error } = await (
    await tabla("carrusel_equipos")
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("asignacion_id", asignacionId)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(roboxId, asignacion.contrato_id);
  redirect(`/flota/${roboxId}`);
}

/** Registra que el Robox pasó a otro tanque. El origen es el tanque donde estaba. */
export async function registrarMovimiento(
  roboxId: string,
  asignacionId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(roboxId) || !esId(asignacionId))
    return { error: "Registro no válido." };
  const asignacion = await buscarAsignacion(roboxId, asignacionId);
  if (!asignacion || asignacion.fecha_fin !== null)
    return { error: "La asignación ya terminó." };

  const campos = camposMovimiento([], "");
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const [carrusel, movimientos, ubicacion] = await Promise.all([
    carruselDeAsignacion(asignacionId),
    movimientosDeAsignacion(asignacionId),
    ubicaciones({ roboxIds: [roboxId] }),
  ]);
  const tanqueActualId = ubicacion.get(roboxId)?.tanqueId ?? null;
  const problema = problemaMovimiento({
    fecha: String(parsed.data.fecha),
    destinoId: String(parsed.data.equipo_destino_id),
    tanqueActualId,
    carruselIds: carrusel.map((k) => k.equipo_cliente_id),
    inicioAsignacion: asignacion.fecha_inicio,
    ultimoMovimiento: movimientos[0]?.fecha ?? null,
  });
  if (problema) return { error: problema };

  const { data, error } = await (
    await tabla("movimientos_robox")
  )
    .insert({
      ...aFila(campos, parsed.data, false),
      asignacion_id: asignacionId,
      planta_id: asignacion.planta_id,
      equipo_origen_id: tanqueActualId,
    })
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(roboxId, asignacion.contrato_id);
  redirect(`/flota/${roboxId}`);
}

/** Deshace el último movimiento (para corregir un error de captura). */
export async function deshacerUltimoMovimiento(
  roboxId: string,
  asignacionId: string,
): Promise<void> {
  await requirePermiso(PERMISO);
  if (!esId(roboxId) || !esId(asignacionId)) return;
  const asignacion = await buscarAsignacion(roboxId, asignacionId);
  const ultimo = (await movimientosDeAsignacion(asignacionId))[0];
  if (!asignacion || !ultimo) return;

  await (
    await tabla("movimientos_robox")
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", ultimo.id)
    .eq("asignacion_id", asignacionId);
  refrescar(roboxId, asignacion.contrato_id);
}
