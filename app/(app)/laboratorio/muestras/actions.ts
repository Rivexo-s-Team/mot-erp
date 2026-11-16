"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { obtenerMuestra, opcionesMuestra } from "@/lib/laboratorio/data";
import {
  accionesMuestra,
  camposMuestra,
  estadoInicial,
  validarMuestra,
} from "@/lib/laboratorio/muestras";
import { createClient } from "@/lib/supabase/server";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

async function cliente() {
  return (await createClient()) as unknown as SupabaseClient;
}

function mensajeError(code: string | undefined): string {
  if (code === "23505") return "Ya existe una muestra con ese ID.";
  if (code === "23503")
    return "El equipo, la orden o la oportunidad no son de ese cliente.";
  if (code === "23514") return "Revisa las fechas, el estado y el ID.";
  if (code === "42501") return "Tu rol no puede registrar muestras.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar(m: {
  id?: string;
  orden_id?: unknown;
  oportunidad_id?: unknown;
}) {
  revalidatePath("/laboratorio/muestras");
  if (m.id) revalidatePath(`/laboratorio/muestras/${m.id}`);
  if (typeof m.orden_id === "string") revalidatePath(`/ordenes/${m.orden_id}`);
  if (typeof m.oportunidad_id === "string")
    revalidatePath(`/oportunidades/${m.oportunidad_id}`);
}

/** Registra una muestra (id = null) de un cliente o corrige una existente. */
export async function guardarMuestra(
  cuentaId: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("laboratorio.editar");
  if (!esId(cuentaId) || (id !== null && !esId(id)))
    return { error: "Registro no válido." };

  const actual = id ? await obtenerMuestra(id) : null;
  if (id && (!actual || actual.cuenta_id !== cuentaId))
    return { error: "La muestra ya no existe." };

  const opciones = await opcionesMuestra(cuentaId);
  const campos = camposMuestra(id !== null, opciones, hoyEnMexico());
  const parsed = esquemaCampos(campos, validarMuestra).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const fila = aFila(campos, parsed.data, id !== null);

  // La planta sale del equipo: no se captura dos veces.
  const supabase = await cliente();
  const { data: equipo } = await supabase
    .from("equipos_cliente")
    .select("planta_id, plantas!inner (cuenta_id)")
    .eq("id", fila.equipo_cliente_id)
    .eq("plantas.cuenta_id", cuentaId)
    .maybeSingle();
  if (!equipo) return { error: "El equipo no es de ese cliente." };
  fila.planta_id = equipo.planta_id as string;

  if (id) {
    const { data, error } = await supabase
      .from("muestras")
      .update(fila)
      .eq("id", id)
      .select("id");
    if (error || !data?.[0])
      return { error: mensajeError(error?.code ?? "42501") };
    refrescar({ id, ...fila });
    if (actual) refrescar(actual);
    redirect(`/laboratorio/muestras/${id}`);
  }

  const { data, error } = await supabase
    .from("muestras")
    .insert({
      ...fila,
      cuenta_id: cuentaId,
      estado: estadoInicial(fila.fecha_recepcion as string | null),
    })
    .select("id");
  const nueva = data?.[0] as { id: string } | undefined;
  if (error || !nueva) return { error: mensajeError(error?.code ?? "42501") };
  refrescar({ id: nueva.id, ...fila });
  redirect(`/laboratorio/muestras/${nueva.id}`);
}

/** La muestra llegó hoy al laboratorio. Se llama desde un botón de su ficha. */
export async function recibirMuestra(id: string): Promise<void> {
  await requirePermiso("laboratorio.editar");
  if (!esId(id)) return;
  const actual = await obtenerMuestra(id);
  const hoy = hoyEnMexico();
  // Si la fecha de muestreo es posterior a hoy, primero hay que corregirla.
  if (
    !actual ||
    !accionesMuestra(actual.estado).recibir ||
    hoy < actual.fecha_muestreo
  )
    return;

  const supabase = await cliente();
  await supabase
    .from("muestras")
    .update({ estado: "recibida", fecha_recepcion: hoy })
    .eq("id", id)
    .eq("estado", "pendiente");
  refrescar(actual);
  redirect(`/laboratorio/muestras/${id}`);
}

/** Quita una muestra capturada por error. */
export async function eliminarMuestra(id: string): Promise<ActionResult> {
  await requirePermiso("laboratorio.editar");
  if (!esId(id)) return { error: "Registro no válido." };
  const actual = await obtenerMuestra(id);
  if (!actual) return { error: "La muestra ya no existe." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("muestras")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };
  refrescar(actual);
  redirect("/laboratorio/muestras");
}
