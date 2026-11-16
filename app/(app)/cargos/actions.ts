"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { camposCargo } from "@/lib/cargos/campos";
import { obtenerCargo } from "@/lib/cargos/data";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { obtenerOrden } from "@/lib/ordenes/data";
import { createClient } from "@/lib/supabase/server";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** Los cargos son importes: además de capturarlos hay que poder ver precios. */
async function requireCargos() {
  const sesion = await requirePermiso("cargos.editar");
  if (!tienePermiso(sesion, "precios.ver")) redirect("/");
}

async function tabla() {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from("cargos");
}

function mensajeError(code: string | undefined): string {
  if (code === "23505") return "Esa orden ya tiene su cargo por litros.";
  if (code === "23514") return "Revisa la cantidad y el precio.";
  if (code === "42501") return "Tu rol no puede capturar cargos.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar(ordenId?: string | null) {
  revalidatePath("/cargos");
  if (ordenId) revalidatePath(`/ordenes/${ordenId}`);
}

/**
 * Captura un cargo (id = null) para un cliente, opcionalmente ligado a una
 * orden de servicio, o corrige uno existente.
 */
export async function guardarCargo(
  cuentaId: string,
  ordenId: string | null,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requireCargos();
  if (
    !esId(cuentaId) ||
    (ordenId !== null && !esId(ordenId)) ||
    (id !== null && !esId(id))
  )
    return { error: "Registro no válido." };

  const actual = id ? await obtenerCargo(id) : null;
  if (id && !actual) return { error: "El cargo ya no existe." };
  if (actual?.estado === "facturado")
    return { error: "Un cargo ya facturado no se cambia." };

  const campos = camposCargo(id !== null, actual?.tipo);
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  if (parsed.data.cantidad !== "" && Number(parsed.data.cantidad) <= 0)
    return { error: "La cantidad debe ser mayor que cero." };
  const fila = aFila(campos, parsed.data, id !== null);

  const t = await tabla();
  if (id) {
    const { data, error } = await t.update(fila).eq("id", id).select("id");
    if (error || !data?.[0])
      return { error: mensajeError(error?.code ?? "42501") };
    refrescar(actual?.orden_id);
    redirect("/cargos");
  }

  // Alta: si viene de una orden, se liga a ella y a su contrato.
  let contratoId: string | null = null;
  if (ordenId) {
    const orden = await obtenerOrden(ordenId);
    if (!orden || orden.cuenta_id !== cuentaId)
      return { error: "La orden no es de ese cliente." };
    contratoId = orden.contrato_id;
  }
  const { data, error } = await t
    .insert({
      ...fila,
      cuenta_id: cuentaId,
      orden_id: ordenId,
      contrato_id: contratoId,
    })
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(ordenId);
  redirect(ordenId ? `/ordenes/${ordenId}` : "/cargos");
}
