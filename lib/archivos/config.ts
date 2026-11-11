/** Reglas de los archivos que se suben. Deben coincidir con los buckets de Storage. */

export const MAX_BYTES = 10 * 1024 * 1024;

export const TIPOS_PERMITIDOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export const ACEPTA = Object.keys(TIPOS_PERMITIDOS).join(",");

export type MetaArchivo = { nombre: string; tipo: string; tamano: number };

/** Devuelve el motivo por el que no se puede subir, o null si está bien. */
export function validarArchivo(meta: MetaArchivo): string | null {
  if (!(meta.tipo in TIPOS_PERMITIDOS)) {
    return "Solo se aceptan PDF o imágenes (JPG, PNG, WEBP, HEIC).";
  }
  if (!Number.isFinite(meta.tamano) || meta.tamano <= 0)
    return "El archivo está vacío.";
  if (meta.tamano > MAX_BYTES) return "El archivo pesa más de 10 MB.";
  if (meta.nombre.trim() === "") return "El archivo no tiene nombre.";
  return null;
}

/** Nombre para mostrar: sin rutas ni caracteres raros, y de largo razonable. */
export function limpiarNombre(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? nombre;
  return base
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 150);
}

/** "1.5 MB", "320 KB". */
export function formatTamano(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const BUCKETS = {
  adjunto: "adjuntos-oportunidades",
  comprobante: "comprobantes-precio",
} as const;
