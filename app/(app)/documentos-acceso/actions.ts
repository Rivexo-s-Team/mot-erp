"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obtenerDocumento, tiposDeDocumento } from "@/lib/acceso/data";
import { camposDocumento, validarDocumento } from "@/lib/acceso/documentos";
import {
  limpiarNombre,
  validarArchivo,
  type MetaArchivo,
} from "@/lib/archivos/config";
import {
  existeEnStorage,
  permisoTemporal,
  type Subida,
} from "@/lib/archivos/subida";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { createClient } from "@/lib/supabase/server";

const PERMISO = "documentos_acceso.editar";
const BUCKET = "documentos-acceso";
const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;
const metaSchema = z.object({
  nombre: z.string(),
  tipo: z.string(),
  tamano: z.number(),
});

/** RLS decide el acceso; aquí solo se nombra la tabla. */
async function tabla() {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from("documentos_acceso");
}

function mensajeError(code: string | undefined): string {
  if (code === "P0001")
    return "Revisa de quién es el documento: los de MOT van sin persona y los personales necesitan una.";
  if (code === "42501")
    return "Tu rol no puede registrar documentos de acceso.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar() {
  revalidatePath("/documentos-acceso");
  // El estado de los documentos se muestra en las órdenes.
  revalidatePath("/ordenes", "layout");
  revalidatePath("/campo", "layout");
}

/** Registra un documento (id = null) o corrige su vencimiento y notas. */
export async function guardarDocumento(
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (id !== null && !esId(id)) return { error: "Registro no válido." };
  const tipos = await tiposDeDocumento();
  const campos = camposDocumento([], []);
  const parsed = esquemaCampos(
    campos,
    // Al editar, el tipo y la persona ya no cambian.
    id === null
      ? validarDocumento(
          tipos.filter((t) => t.aplica_a === "persona").map((t) => t.id),
        )
      : undefined,
  ).safeParse(valores);
  if (!parsed.success)
    return { error: "Revisa de quién es el documento y los demás datos." };

  const fila = aFila(campos, parsed.data, id !== null);
  const t = await tabla();
  const { data, error } = id
    ? await t.update(fila).eq("id", id).select("id")
    : await t.insert(fila).select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  refrescar();
  // Recién creado: a su ficha, para subirle el archivo.
  redirect(
    id
      ? "/documentos-acceso"
      : `/documentos-acceso/${(data[0] as { id: string }).id}`,
  );
}

/** Lo quita de la lista (por ejemplo, uno ya renovado). El archivo se conserva. */
export async function eliminarDocumento(id: string): Promise<ActionResult> {
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
  refrescar();
  redirect("/documentos-acceso");
}

// Archivo del documento: subida en dos pasos (ver CLAUDE.md, "Archivos") --------

async function problemaArchivo(
  id: string,
  meta: MetaArchivo,
): Promise<string | null> {
  if (!esId(id) || !metaSchema.safeParse(meta).success)
    return "Archivo no válido.";
  const motivo = validarArchivo(meta);
  if (motivo) return motivo;
  const doc = await obtenerDocumento(id);
  if (!doc) return "El documento no existe.";
  if (doc.archivo_ruta)
    return "Este documento ya tiene archivo. Si se renovó, registra un documento nuevo.";
  return null;
}

export async function prepararArchivoDocumento(
  id: string,
  meta: MetaArchivo,
): Promise<Subida | { error: string }> {
  await requirePermiso(PERMISO);
  const motivo = await problemaArchivo(id, meta);
  if (motivo) return { error: motivo };
  return permisoTemporal(BUCKET, id, meta);
}

export async function registrarArchivoDocumento(
  id: string,
  ruta: string,
  meta: MetaArchivo,
): Promise<{ error: string } | undefined> {
  await requirePermiso(PERMISO);
  const motivo = await problemaArchivo(id, meta);
  if (motivo) return { error: motivo };
  if (!(await existeEnStorage(BUCKET, id, ruta)))
    return { error: "El archivo no terminó de subirse. Intenta de nuevo." };

  const { data, error } = await (
    await tabla()
  )
    .update({ archivo_ruta: ruta, archivo_nombre: limpiarNombre(meta.nombre) })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0])
    return { error: "El archivo se subió, pero no se pudo registrar." };
  refrescar();
  revalidatePath(`/documentos-acceso/${id}`);
}
