"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { camposVisita } from "@/lib/agenda/campos";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { obtenerContrato } from "@/lib/contratos/data";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { createClient } from "@/lib/supabase/server";

const PERMISO = "ordenes.editar";
const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** RLS decide el acceso; aquí solo se nombra la tabla. */
async function tabla() {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from("visitas_programadas");
}

function mensajeError(code: string | undefined): string {
  if (code === "23503") return "El equipo debe ser de la planta del contrato.";
  if (code === "23514") return "Revisa la frecuencia: debe ser mayor que cero.";
  if (code === "42501") return "Tu rol no puede hacer este cambio.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar(contratoId?: string) {
  revalidatePath("/agenda");
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
}

/** Crea (id = null) o edita la visita recurrente de un contrato. */
export async function guardarVisita(
  contratoId: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(contratoId) || (id !== null && !esId(id)))
    return { error: "Registro no válido." };
  const campos = camposVisita([], [], [], "");
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  if (Number(parsed.data.cada_cantidad) < 1)
    return { error: "La frecuencia debe ser de al menos 1." };

  const contrato = await obtenerContrato(contratoId);
  if (!contrato) return { error: "El contrato ya no existe." };

  const fila = aFila(campos, parsed.data, id !== null);
  const t = await tabla();
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

  refrescar(contratoId);
  redirect("/agenda");
}

export async function eliminarVisita(
  contratoId: string,
  id: string,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(contratoId) || !esId(id)) return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla()
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("contrato_id", contratoId)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(contratoId);
  redirect("/agenda");
}

/**
 * Programa la siguiente visita: la base crea la orden de servicio y avanza la
 * fecha, todo o nada. Lleva a la orden recién creada.
 */
export async function programarVisita(id: string): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(id)) return { error: "Registro no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("programar_visita", {
    p_visita: id,
  });
  if (error || !data) {
    return {
      error:
        error?.code === "42501"
          ? "Esa visita está asignada a otro técnico; solo él o Dirección pueden programarla."
          : error?.code === "P0001"
            ? "Esa visita recurrente está pausada o ya no existe."
            : "No se pudo programar la visita.",
    };
  }
  revalidatePath("/agenda");
  revalidatePath("/ordenes");
  revalidatePath("/campo");
  redirect(`/ordenes/${data}`);
}
