import "server-only";
import {
  TIPOS_PERMITIDOS,
  validarArchivo,
  type MetaArchivo,
} from "@/lib/archivos/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Piezas de la subida en dos pasos (ver CLAUDE.md, "Archivos"). Las usan las
 * acciones de cada módulo, que antes revisan el permiso.
 */

export type Subida = { bucket: string; ruta: string; token: string };

/** Paso 1: permiso temporal para subir un archivo nuevo a `carpeta`. */
export async function permisoTemporal(
  bucket: string,
  carpeta: string,
  meta: MetaArchivo,
): Promise<Subida | { error: string }> {
  const problema = validarArchivo(meta);
  if (problema) return { error: problema };
  const ruta = `${carpeta}/${crypto.randomUUID()}.${TIPOS_PERMITIDOS[meta.tipo]}`;

  // Con la sesión del usuario: Storage aplica sus políticas por rol.
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(ruta);
  if (error || !data) return { error: "Tu rol no puede subir archivos aquí." };
  return { bucket, ruta, token: data.token };
}

/** Paso 2: confirma que el archivo existe en la carpeta que le corresponde. */
export async function existeEnStorage(
  bucket: string,
  carpeta: string,
  ruta: string,
): Promise<boolean> {
  if (!ruta.startsWith(`${carpeta}/`) || ruta.includes("..")) return false;
  const archivo = ruta.slice(carpeta.length + 1);
  if (archivo.includes("/")) return false;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(bucket)
    .list(carpeta, { search: archivo });
  return Boolean(data?.some((o) => o.name === archivo));
}
