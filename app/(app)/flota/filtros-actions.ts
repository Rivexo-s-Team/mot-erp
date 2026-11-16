"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { camposFiltro, validarFiltro } from "@/lib/flota/filtros";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { createClient } from "@/lib/supabase/server";

const PERMISO = "flota.editar";
const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** RLS decide el acceso; aquí solo se nombra la tabla. */
async function tabla() {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from("filtros_instalados");
}

function mensajeError(code: string | undefined): string {
  if (code === "23505")
    return "Ese Robox ya tiene instalado un filtro de ese tipo. Primero pon la fecha en que se retiró.";
  if (code === "P0001")
    return "Esa parte no está marcada como filtro en el catálogo.";
  if (code === "23514") return "Revisa las fechas.";
  if (code === "42501") return "Tu rol no puede hacer este cambio.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar(roboxId: string) {
  revalidatePath("/flota");
  revalidatePath(`/flota/${roboxId}`);
}

/** Registra (id = null) el filtro que tiene un Robox, o corrige sus fechas. */
export async function guardarFiltro(
  roboxId: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(roboxId) || (id !== null && !esId(id)))
    return { error: "Registro no válido." };
  const campos = camposFiltro([], "", id !== null);
  const parsed = esquemaCampos(campos, validarFiltro).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const fila = aFila(campos, parsed.data, id !== null);
  const t = await tabla();
  const { data, error } = id
    ? await t.update(fila).eq("id", id).eq("robox_id", roboxId).select("id")
    : await t.insert({ ...fila, robox_id: roboxId }).select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(roboxId);
  redirect(`/flota/${roboxId}`);
}

/** Quita un registro capturado por error. */
export async function eliminarFiltro(
  roboxId: string,
  id: string,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(roboxId) || !esId(id)) return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla()
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("robox_id", roboxId)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(roboxId);
  redirect(`/flota/${roboxId}`);
}
