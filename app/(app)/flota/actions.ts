"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { CAMPOS_ROBOX } from "@/lib/flota/campos";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { createClient } from "@/lib/supabase/server";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** RLS decide el acceso; aquí solo se nombra la tabla. */
async function tabla() {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from("robox");
}

function mensajeError(code: string | undefined): string {
  if (code === "23505") return "Ya existe un Robox con ese número de serie.";
  if (code === "P0001")
    return "Este Robox está asignado a un contrato. Termina primero su asignación.";
  if (code === "42501") return "Tu rol no puede modificar la flota.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

export async function guardarRobox(
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("flota.editar");
  if (id !== null && !esId(id)) return { error: "Registro no válido." };
  const parsed = esquemaCampos(CAMPOS_ROBOX).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const fila = aFila(CAMPOS_ROBOX, parsed.data, id !== null);
  const t = await tabla();
  const { data, error } = id
    ? await t.update(fila).eq("id", id).select("id")
    : await t.insert(fila).select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  const destino = `/flota/${(data[0] as { id: string }).id}`;
  revalidatePath("/flota");
  revalidatePath(destino);
  redirect(destino);
}

/** Lo quita de la lista (borrado lógico). Para un equipo que salió de servicio, usa el estado Baja. */
export async function eliminarRobox(id: string): Promise<ActionResult> {
  await requirePermiso("flota.editar");
  if (!esId(id)) return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla()
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath("/flota");
  redirect("/flota");
}
