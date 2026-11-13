"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import {
  accionesOrden,
  camposOrden,
  SIN_OPCIONES,
  validarOrden,
} from "@/lib/ordenes/campos";
import {
  aCargaUtil,
  problemaCaptura,
  type Captura,
} from "@/lib/ordenes/captura";
import { directorioTecnicos, obtenerOrden } from "@/lib/ordenes/data";
import { createClient } from "@/lib/supabase/server";

const PERMISO = "ordenes.editar";
const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** RLS decide el acceso; aquí solo se nombra la tabla. */
async function tabla() {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from("ordenes_servicio");
}

function mensajeError(code: string | undefined): string {
  if (code === "P0001")
    return "La orden ya está cerrada y no se puede cambiar.";
  if (code === "23503")
    return "El contrato y el equipo deben ser de la planta elegida.";
  if (code === "23514") return "Revisa los datos de la orden.";
  if (code === "42501")
    return "Solo puedes cambiar las órdenes donde vas como técnico o acompañante.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar(id?: string) {
  revalidatePath("/ordenes");
  revalidatePath("/campo");
  if (id) {
    revalidatePath(`/ordenes/${id}`);
    revalidatePath(`/campo/ordenes/${id}`);
  }
}

/**
 * Crea (id = null) o edita el encabezado de una orden. Sin cuenta es un
 * trabajo de taller. Quien no administra órdenes queda como técnico responsable.
 */
export async function guardarOrden(
  cuentaId: string | null,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  const sesion = await requirePermiso(PERMISO);
  if ((cuentaId !== null && !esId(cuentaId)) || (id !== null && !esId(id)))
    return { error: "Registro no válido." };

  const administra = tienePermiso(sesion, "ordenes.administrar");
  const tipo = cuentaId ? "visita" : "taller";
  const campos = camposOrden(tipo, SIN_OPCIONES, "", administra);
  const parsed = esquemaCampos(campos, validarOrden).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  // El responsable y el acompañante deben poder llevar órdenes.
  const { asignables } = await directorioTecnicos();
  const puede = (v: unknown) => asignables.some((t) => t.value === v);
  const fila = aFila(campos, parsed.data, id !== null);
  if (administra && !puede(fila.tecnico_id))
    return { error: "Elige un técnico activo." };
  if (fila.acompanante_id && !puede(fila.acompanante_id))
    return { error: "El acompañante debe ser un técnico activo." };
  if (!administra && fila.acompanante_id === sesion.id)
    return { error: "El acompañante no puede ser el mismo técnico." };

  const t = await tabla();
  const { data, error } = id
    ? await t.update(fila).eq("id", id).select("id")
    : await t
        .insert({
          ...fila,
          tipo,
          cuenta_id: cuentaId,
          ...(administra ? {} : { tecnico_id: sesion.id }),
        })
        .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  const nuevoId = (data[0] as { id: string }).id;
  refrescar(nuevoId);
  redirect(`/ordenes/${nuevoId}`);
}

export async function eliminarOrden(id: string): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(id)) return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla()
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar(id);
  redirect("/ordenes");
}

type Cambio = "iniciar" | "cancelar" | "reactivar";

/**
 * Cambia el estado de una orden desde un botón. `volver` es la pantalla desde
 * donde se pidió (escritorio o campo). Cerrar la orden llega con las firmas.
 */
export async function cambiarEstadoOrden(
  id: string,
  cambio: Cambio,
  volver: "ordenes" | "campo",
): Promise<void> {
  await requirePermiso(PERMISO);
  if (!esId(id)) return;
  const orden = await obtenerOrden(id);
  if (!orden || !accionesOrden(orden.estado)[cambio]) return;

  const fila =
    cambio === "iniciar"
      ? { estado: "en_curso", fecha_real: hoyEnMexico() }
      : cambio === "cancelar"
        ? { estado: "cancelada" }
        : { estado: "programada", fecha_real: null };
  await (await tabla()).update(fila).eq("id", id);

  refrescar(id);
  redirect(volver === "campo" ? `/campo/ordenes/${id}` : `/ordenes/${id}`);
}

export type ResultadoCaptura = { ok: true } | { ok: false; error: string };

/**
 * Guarda de una vez lo capturado en la visita. El celular la llama al
 * escribir y, si no había señal, otra vez al recuperarla: enviar dos veces lo
 * mismo deja el mismo resultado.
 */
export async function guardarCaptura(
  ordenId: string,
  captura: Captura,
): Promise<ResultadoCaptura> {
  await requirePermiso(PERMISO);
  if (!esId(ordenId)) return { ok: false, error: "Registro no válido." };
  const problema = problemaCaptura(captura);
  if (problema) return { ok: false, error: problema.mensaje };

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_captura_orden", {
    p_orden: ordenId,
    p_captura: aCargaUtil(captura),
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501" || error.code === "P0001"
          ? "Ya no puedes capturar en esta orden (está cerrada o no es tuya)."
          : "No se pudo guardar. Revisa los datos.",
    };
  }
  revalidatePath(`/ordenes/${ordenId}`);
  revalidatePath(`/campo/ordenes/${ordenId}`);
  return { ok: true };
}

/**
 * Cierra una orden en curso. La base exige las firmas (del técnico y, en una
 * visita, del responsable del cliente); después de cerrarla ya no cambia.
 */
export async function cerrarOrden(
  id: string,
  volver: "ordenes" | "campo",
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(id)) return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla()
  )
    .update({ estado: "cerrada" })
    .eq("id", id)
    .eq("estado", "en_curso")
    .select("id");
  // P0001 trae el motivo escrito en la base (qué firma falta).
  if (error?.code === "P0001") return { error: error.message };
  if (error || !data?.[0])
    return {
      error: "No se pudo cerrar. Revisa que la orden siga en curso y sea tuya.",
    };

  refrescar(id);
  redirect(volver === "campo" ? `/campo/ordenes/${id}` : `/ordenes/${id}`);
}
