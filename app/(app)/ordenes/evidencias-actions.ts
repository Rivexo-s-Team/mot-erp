"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  BUCKETS,
  limpiarNombre,
  TIPOS_EVIDENCIA,
  validarArchivo,
  type MetaArchivo,
} from "@/lib/archivos/config";
import {
  existeEnStorage,
  permisoTemporal,
  type Subida,
} from "@/lib/archivos/subida";
import { requirePermiso } from "@/lib/auth/session";
import { obtenerOrden } from "@/lib/ordenes/data";
import { createClient } from "@/lib/supabase/server";

/** Fotos de una orden de servicio. Subida en dos pasos (ver CLAUDE.md, "Archivos"). */

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;
const metaSchema = z.object({
  nombre: z.string(),
  tipo: z.string(),
  tamano: z.number(),
});

/** Solo imágenes, y solo en una orden que siga abierta. La base vuelve a revisarlo. */
async function problema(
  ordenId: string,
  meta: MetaArchivo,
): Promise<string | null> {
  if (!esId(ordenId) || !metaSchema.safeParse(meta).success)
    return "Archivo no válido.";
  if (!meta.tipo.startsWith("image/"))
    return "Solo se aceptan fotos (JPG, PNG, WEBP, HEIC).";
  const motivo = validarArchivo(meta);
  if (motivo) return motivo;
  const orden = await obtenerOrden(ordenId);
  if (!orden) return "La orden no existe.";
  if (orden.estado === "cerrada")
    return "La orden ya está cerrada; no se le agregan fotos.";
  return null;
}

function refrescar(ordenId: string) {
  revalidatePath(`/ordenes/${ordenId}`);
  revalidatePath(`/campo/ordenes/${ordenId}`);
}

export async function prepararEvidencia(
  ordenId: string,
  meta: MetaArchivo,
): Promise<Subida | { error: string }> {
  await requirePermiso("ordenes.editar");
  const motivo = await problema(ordenId, meta);
  if (motivo) return { error: motivo };
  const permiso = await permisoTemporal(BUCKETS.evidencia, ordenId, meta);
  return "error" in permiso
    ? { error: "Solo quien lleva la orden puede subirle fotos." }
    : permiso;
}

export async function registrarEvidencia(
  ordenId: string,
  tipo: string,
  ruta: string,
  meta: MetaArchivo,
): Promise<{ error: string } | undefined> {
  await requirePermiso("ordenes.editar");
  const motivo = await problema(ordenId, meta);
  if (motivo) return { error: motivo };
  if (!TIPOS_EVIDENCIA.some((t) => t.value === tipo))
    return { error: "Elige qué muestra la foto." };
  if (!(await existeEnStorage(BUCKETS.evidencia, ordenId, ruta)))
    return { error: "La foto no terminó de subirse. Intenta de nuevo." };

  const supabase = await createClient();
  const { error } = await supabase.from("os_evidencias").insert({
    orden_id: ordenId,
    tipo,
    nombre: limpiarNombre(meta.nombre),
    ruta,
    tipo_mime: meta.tipo,
    tamano_bytes: meta.tamano,
  });
  if (error) return { error: "La foto se subió, pero no se pudo registrar." };
  refrescar(ordenId);
}

/** La oculta de la orden; el archivo se conserva en Storage. */
export async function quitarEvidencia(
  ordenId: string,
  id: string,
): Promise<void> {
  await requirePermiso("ordenes.editar");
  if (!esId(ordenId) || !esId(id)) return;
  const supabase = await createClient();
  await supabase
    .from("os_evidencias")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("orden_id", ordenId);
  refrescar(ordenId);
}
