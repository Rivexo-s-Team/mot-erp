"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import {
  CAMPOS_COTIZACION,
  camposPartida,
  validarCotizacion,
  validarPartida,
} from "@/lib/cotizaciones/campos";
import { precioSugeridoPorLitro } from "@/lib/cotizaciones/cotizador";
import {
  obtenerCotizacion,
  parametrosCotizador,
} from "@/lib/cotizaciones/data";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { createClient } from "@/lib/supabase/server";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** Cotizar exige editar el pipeline y, además, poder ver precios. */
async function requireCotizar() {
  const sesion = await requirePermiso("oportunidades.editar");
  if (!tienePermiso(sesion, "precios.ver")) redirect("/oportunidades");
  return sesion;
}

/** Las tablas se nombran aquí, nunca con datos del usuario; RLS decide el acceso. */
async function tabla(nombre: "cotizaciones" | "cotizacion_lineas") {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from(nombre);
}

function mensajeError(code: string | undefined): string {
  if (code === "P0001")
    return "La cotización ya fue enviada. Crea una versión nueva para cambiarla.";
  if (code === "42501") return "Tu rol no puede hacer este cambio.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

const ruta = (oportunidadId: string, cotizacionId?: string) =>
  `/oportunidades/${oportunidadId}${cotizacionId ? `/cotizaciones/${cotizacionId}` : ""}`;

/** Siguiente número de versión de la oportunidad. */
async function siguienteVersion(oportunidadId: string): Promise<number> {
  const { data } = await (
    await tabla("cotizaciones")
  )
    .select("version")
    .eq("oportunidad_id", oportunidadId)
    .is("deleted_at", null)
    .order("version", { ascending: false })
    .limit(1);
  return ((data?.[0] as { version: number } | undefined)?.version ?? 0) + 1;
}

/** Crea una cotización vacía (en USD) y abre su pantalla. */
export async function crearCotizacion(oportunidadId: string): Promise<void> {
  await requireCotizar();
  if (!esId(oportunidadId)) throw new Error("Oportunidad no válida.");
  const { data, error } = await (
    await tabla("cotizaciones")
  )
    .insert({
      oportunidad_id: oportunidadId,
      version: await siguienteVersion(oportunidadId),
    })
    .select("id");
  if (error || !data?.[0]) throw new Error("No se pudo crear la cotización.");

  revalidatePath(ruta(oportunidadId));
  redirect(ruta(oportunidadId, (data[0] as { id: string }).id));
}

export async function guardarCotizacion(
  oportunidadId: string,
  cotizacionId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requireCotizar();
  if (!esId(oportunidadId) || !esId(cotizacionId))
    return { error: "Registro no válido." };
  const parsed = esquemaCampos(CAMPOS_COTIZACION, validarCotizacion).safeParse(
    valores,
  );
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const fila = aFila(CAMPOS_COTIZACION, parsed.data, true);
  if (fila.moneda === "USD") fila.tipo_cambio = null;
  const { data, error } = await (
    await tabla("cotizaciones")
  )
    .update(fila)
    .eq("id", cotizacionId)
    .eq("oportunidad_id", oportunidadId)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath(ruta(oportunidadId, cotizacionId));
  redirect(ruta(oportunidadId, cotizacionId));
}

export async function guardarPartida(
  oportunidadId: string,
  cotizacionId: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requireCotizar();
  if (
    !esId(oportunidadId) ||
    !esId(cotizacionId) ||
    (id !== null && !esId(id))
  ) {
    return { error: "Registro no válido." };
  }
  const cotizacion = await obtenerCotizacion(oportunidadId, cotizacionId);
  if (!cotizacion) return { error: "La cotización no existe." };

  const campos = camposPartida([]);
  const parsed = esquemaCampos(campos, validarPartida).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const fila = aFila(campos, parsed.data, id !== null);

  // Sin precio capturado, se usa el que sugiere el cotizador.
  if (fila.precio_unitario === null) {
    const parametros = await parametrosCotizador();
    const sugerencia = parametros
      ? precioSugeridoPorLitro(
          String(parsed.data.precio_referencia),
          parametros,
          cotizacion.moneda,
          cotizacion.tipo_cambio,
        )
      : null;
    if (!sugerencia) {
      return {
        error:
          "No se pudo calcular el precio sugerido. Escribe el precio unitario.",
      };
    }
    fila.precio_unitario = Number(sugerencia.precio);
  }

  const t = await tabla("cotizacion_lineas");
  const { data, error } = id
    ? await t
        .update(fila)
        .eq("id", id)
        .eq("cotizacion_id", cotizacionId)
        .select("id")
    : await t.insert({ ...fila, cotizacion_id: cotizacionId }).select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath(ruta(oportunidadId, cotizacionId));
  redirect(ruta(oportunidadId, cotizacionId));
}

export async function eliminarPartida(
  oportunidadId: string,
  cotizacionId: string,
  id: string,
): Promise<ActionResult> {
  await requireCotizar();
  if (!esId(oportunidadId) || !esId(cotizacionId) || !esId(id))
    return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla("cotizacion_lineas")
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("cotizacion_id", cotizacionId)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath(ruta(oportunidadId, cotizacionId));
  redirect(ruta(oportunidadId, cotizacionId));
}

/** La marca como enviada: desde ahí ya no se puede editar. */
export async function marcarEnviada(
  oportunidadId: string,
  cotizacionId: string,
): Promise<void> {
  await requireCotizar();
  if (!esId(oportunidadId) || !esId(cotizacionId))
    throw new Error("Cotización no válida.");
  const cotizacion = await obtenerCotizacion(oportunidadId, cotizacionId);
  if (!cotizacion) throw new Error("La cotización no existe.");
  if (cotizacion.lineas.length === 0) {
    throw new Error(
      "Agrega al menos una partida antes de marcarla como enviada.",
    );
  }
  const { error } = await (
    await tabla("cotizaciones")
  )
    .update({ estado: "enviada" })
    .eq("id", cotizacionId)
    .eq("oportunidad_id", oportunidadId);
  if (error) throw new Error("No se pudo marcar como enviada.");

  revalidatePath(ruta(oportunidadId));
  revalidatePath(ruta(oportunidadId, cotizacionId));
  redirect(ruta(oportunidadId, cotizacionId));
}

/** Copia la cotización (datos y partidas) a una versión nueva en borrador. */
export async function crearNuevaVersion(
  oportunidadId: string,
  cotizacionId: string,
): Promise<void> {
  await requireCotizar();
  if (!esId(oportunidadId) || !esId(cotizacionId))
    throw new Error("Cotización no válida.");
  const origen = await obtenerCotizacion(oportunidadId, cotizacionId);
  if (!origen) throw new Error("La cotización no existe.");

  const { data, error } = await (
    await tabla("cotizaciones")
  )
    .insert({
      oportunidad_id: oportunidadId,
      version: await siguienteVersion(oportunidadId),
      moneda: origen.moneda,
      tipo_cambio: origen.tipo_cambio,
      vigencia: origen.vigencia,
      valor_total_contrato: origen.valor_total_contrato,
      litros_estimados: origen.litros_estimados,
      condiciones: origen.condiciones,
      notas: origen.notas,
    })
    .select("id");
  if (error || !data?.[0])
    throw new Error("No se pudo crear la versión nueva.");
  const nuevaId = (data[0] as { id: string }).id;

  if (origen.lineas.length > 0) {
    const { error: errorLineas } = await (
      await tabla("cotizacion_lineas")
    ).insert(
      origen.lineas.map((l) => ({
        cotizacion_id: nuevaId,
        orden: l.orden,
        concepto: l.concepto,
        equipo_cliente_id: l.equipo_cliente_id,
        cantidad: l.cantidad,
        unidad: l.unidad,
        precio_unitario: l.precio_unitario,
        recurrente: l.recurrente,
        precio_referencia: l.precio_referencia,
        fuente_tipo: l.fuente_tipo,
        fuente_url: l.fuente_url,
        fecha_referencia: l.fecha_referencia,
        // La versión nueva apunta al mismo comprobante; el archivo no se duplica.
        fuente_archivo_ruta: l.fuente_archivo_ruta,
        fuente_archivo_nombre: l.fuente_archivo_nombre,
      })),
    );
    if (errorLineas)
      throw new Error("Se creó la versión, pero no se copiaron sus partidas.");
  }

  revalidatePath(ruta(oportunidadId));
  redirect(ruta(oportunidadId, nuevaId));
}

export async function eliminarCotizacion(
  oportunidadId: string,
  cotizacionId: string,
): Promise<ActionResult> {
  await requireCotizar();
  if (!esId(oportunidadId) || !esId(cotizacionId))
    return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla("cotizaciones")
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cotizacionId)
    .eq("oportunidad_id", oportunidadId)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath(ruta(oportunidadId));
  redirect(ruta(oportunidadId));
}
