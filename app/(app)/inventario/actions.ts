"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { esquemaCampos, type Valores } from "@/lib/forms/campos";
import {
  camposMovimiento,
  cantidadConSigno,
  validarMovimiento,
} from "@/lib/inventario/campos";
import { createClient } from "@/lib/supabase/server";

/**
 * Registra una entrada, una salida o un ajuste por conteo. Los movimientos no
 * se editan ni se borran: un error se corrige con otro movimiento.
 */
export async function registrarMovimiento(
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("inventario.editar");
  const parsed = esquemaCampos(
    camposMovimiento([], ""),
    validarMovimiento,
  ).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const v = parsed.data;
  const parteId = String(v.parte_id);
  const cantidad = Number(v.cantidad);
  const notas = String(v.notas).trim() || null;

  const supabase = await createClient();
  if (v.tipo === "ajuste") {
    // La base calcula la diferencia contra la existencia actual.
    const { error } = await supabase.rpc("ajustar_existencia", {
      p_parte: parteId,
      p_contada: cantidad,
      p_notas: notas ?? undefined,
    });
    if (error)
      return {
        error:
          error.code === "42501"
            ? "Tu rol no puede registrar movimientos de inventario."
            : "No se pudo registrar el ajuste.",
      };
  } else {
    const { error } = await (supabase as unknown as SupabaseClient)
      .from("inventario_movimientos")
      .insert({
        parte_id: parteId,
        tipo: v.tipo,
        cantidad: cantidadConSigno(String(v.tipo), cantidad),
        fecha: v.fecha,
        referencia: String(v.referencia).trim() || null,
        notas,
      });
    if (error)
      return {
        error:
          error.code === "42501"
            ? "Tu rol no puede registrar movimientos de inventario."
            : error.code === "23503"
              ? "Esa parte ya no existe en el catálogo."
              : "No se pudo registrar el movimiento.",
      };
  }

  revalidatePath("/inventario");
  revalidatePath(`/inventario/${parteId}`);
  redirect(`/inventario/${parteId}`);
}
