"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { camposHistorial, fechaDeHistorialValida } from "@/lib/flota/campos";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/**
 * Registra un movimiento de almacén de un Robox (salida con su pase, entrada,
 * limpieza, reparación). El historial solo se agrega: no hay edición ni
 * borrado. RLS decide quién puede (flota.editar).
 */
export async function registrarMovimientoDeAlmacen(
  roboxId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("flota.editar");
  if (!z.uuid().safeParse(roboxId).success)
    return { error: "Registro no válido." };
  const hoy = hoyEnMexico();
  const campos = camposHistorial(hoy);
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  if (!fechaDeHistorialValida(String(parsed.data.fecha), hoy))
    return { error: "La fecha no puede ser posterior a hoy." };

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from("robox_historial")
    .insert({ ...aFila(campos, parsed.data, false), robox_id: roboxId })
    .select("id");
  if (error || !data?.[0])
    return {
      error:
        error?.code === "42501" || !error
          ? "Tu rol no puede registrar movimientos de almacén."
          : "No se pudo guardar. Revisa los datos e intenta de nuevo.",
    };

  revalidatePath(`/flota/${roboxId}`);
  redirect(`/flota/${roboxId}`);
}
