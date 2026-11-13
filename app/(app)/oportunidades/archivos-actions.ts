"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  BUCKETS,
  limpiarNombre,
  validarArchivo,
  type MetaArchivo,
} from "@/lib/archivos/config";
import {
  existeEnStorage,
  permisoTemporal,
  type Subida,
} from "@/lib/archivos/subida";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { obtenerCotizacion } from "@/lib/cotizaciones/data";
import { obtenerOportunidad } from "@/lib/pipeline/data";
import { createClient } from "@/lib/supabase/server";

/**
 * Subida de archivos en dos pasos, para que el archivo vaya directo del
 * navegador a Storage (sin pasar por el servidor, que limita el tamaño):
 *   1. preparar…: revisa permisos y entrega un permiso temporal para una ruta.
 *   2. registrar…: confirma que el archivo llegó y lo anota en la base.
 */

type Resultado<T> = T | { error: string };

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;
const metaSchema = z.object({
  nombre: z.string(),
  tipo: z.string(),
  tamano: z.number(),
});

// ---------------------------------------------------------------------------
// Adjuntos de oportunidad
// ---------------------------------------------------------------------------

export async function prepararAdjunto(
  oportunidadId: string,
  meta: MetaArchivo,
): Promise<Resultado<Subida>> {
  await requirePermiso("oportunidades.editar");
  if (!esId(oportunidadId) || !metaSchema.safeParse(meta).success) {
    return { error: "Archivo no válido." };
  }
  if (!(await obtenerOportunidad(oportunidadId)))
    return { error: "La oportunidad no existe." };
  return permisoTemporal(BUCKETS.adjunto, oportunidadId, meta);
}

export async function registrarAdjunto(
  oportunidadId: string,
  ruta: string,
  meta: MetaArchivo,
): Promise<{ error: string } | undefined> {
  await requirePermiso("oportunidades.editar");
  if (
    !esId(oportunidadId) ||
    !metaSchema.safeParse(meta).success ||
    validarArchivo(meta)
  ) {
    return { error: "Archivo no válido." };
  }
  const oportunidad = await obtenerOportunidad(oportunidadId);
  if (!oportunidad) return { error: "La oportunidad no existe." };
  if (!(await existeEnStorage(BUCKETS.adjunto, oportunidadId, ruta))) {
    return { error: "El archivo no terminó de subirse. Intenta de nuevo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("oportunidad_adjuntos").insert({
    oportunidad_id: oportunidadId,
    nombre: limpiarNombre(meta.nombre),
    ruta,
    tipo_mime: meta.tipo,
    tamano_bytes: meta.tamano,
    etapa: oportunidad.etapa,
  });
  if (error)
    return { error: "El archivo se subió, pero no se pudo registrar." };

  revalidatePath(`/oportunidades/${oportunidadId}`);
}

/** Lo oculta de la oportunidad; el archivo se conserva en Storage. */
export async function quitarAdjunto(
  oportunidadId: string,
  id: string,
): Promise<void> {
  await requirePermiso("oportunidades.editar");
  if (!esId(oportunidadId) || !esId(id)) throw new Error("Archivo no válido.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("oportunidad_adjuntos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("oportunidad_id", oportunidadId);
  if (error) throw new Error("No se pudo quitar el archivo.");
  revalidatePath(`/oportunidades/${oportunidadId}`);
}

// ---------------------------------------------------------------------------
// Comprobante del precio de referencia (en una partida de cotización)
// ---------------------------------------------------------------------------

/** Subir comprobantes exige editar el pipeline y ver precios, con la cotización en borrador. */
async function lineaEditable(
  oportunidadId: string,
  cotizacionId: string,
  lineaId: string,
) {
  const sesion = await requirePermiso("oportunidades.editar");
  if (!tienePermiso(sesion, "precios.ver")) return null;
  if (!esId(oportunidadId) || !esId(cotizacionId) || !esId(lineaId))
    return null;
  const cotizacion = await obtenerCotizacion(oportunidadId, cotizacionId);
  if (!cotizacion || cotizacion.estado !== "borrador") return null;
  return cotizacion.lineas.find((l) => l.id === lineaId) ?? null;
}

export async function prepararComprobante(
  oportunidadId: string,
  cotizacionId: string,
  lineaId: string,
  meta: MetaArchivo,
): Promise<Resultado<Subida>> {
  if (!metaSchema.safeParse(meta).success)
    return { error: "Archivo no válido." };
  if (!(await lineaEditable(oportunidadId, cotizacionId, lineaId))) {
    return { error: "Esta partida ya no se puede cambiar." };
  }
  return permisoTemporal(BUCKETS.comprobante, cotizacionId, meta);
}

export async function registrarComprobante(
  oportunidadId: string,
  cotizacionId: string,
  lineaId: string,
  ruta: string,
  meta: MetaArchivo,
): Promise<{ error: string } | undefined> {
  if (!metaSchema.safeParse(meta).success || validarArchivo(meta)) {
    return { error: "Archivo no válido." };
  }
  if (!(await lineaEditable(oportunidadId, cotizacionId, lineaId))) {
    return { error: "Esta partida ya no se puede cambiar." };
  }
  if (!(await existeEnStorage(BUCKETS.comprobante, cotizacionId, ruta))) {
    return { error: "El archivo no terminó de subirse. Intenta de nuevo." };
  }
  return guardarComprobante(oportunidadId, cotizacionId, lineaId, {
    fuente_archivo_ruta: ruta,
    fuente_archivo_nombre: limpiarNombre(meta.nombre),
  });
}

export async function quitarComprobante(
  oportunidadId: string,
  cotizacionId: string,
  lineaId: string,
): Promise<void> {
  if (!(await lineaEditable(oportunidadId, cotizacionId, lineaId))) {
    throw new Error("Esta partida ya no se puede cambiar.");
  }
  const resultado = await guardarComprobante(
    oportunidadId,
    cotizacionId,
    lineaId,
    {
      fuente_archivo_ruta: null,
      fuente_archivo_nombre: null,
    },
  );
  if (resultado) throw new Error(resultado.error);
}

async function guardarComprobante(
  oportunidadId: string,
  cotizacionId: string,
  lineaId: string,
  campos: {
    fuente_archivo_ruta: string | null;
    fuente_archivo_nombre: string | null;
  },
): Promise<{ error: string } | undefined> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from("cotizacion_lineas")
    .update(campos)
    .eq("id", lineaId)
    .eq("cotizacion_id", cotizacionId)
    .select("id");
  if (error || !data?.[0])
    return { error: "No se pudo guardar el comprobante." };

  const base = `/oportunidades/${oportunidadId}/cotizaciones/${cotizacionId}`;
  revalidatePath(base);
  revalidatePath(`${base}/partidas/${lineaId}`);
}
