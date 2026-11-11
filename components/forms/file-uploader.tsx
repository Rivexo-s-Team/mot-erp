"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  ACEPTA,
  validarArchivo,
  type MetaArchivo,
} from "@/lib/archivos/config";
import { createClient } from "@/lib/supabase/client";

type Subida = { bucket: string; ruta: string; token: string };

type FileUploaderProps = {
  texto: string;
  /** Paso 1: el servidor revisa permisos y da un permiso temporal para subir. */
  preparar: (meta: MetaArchivo) => Promise<Subida | { error: string }>;
  /** Paso 2: el servidor confirma que el archivo llegó y lo registra. */
  registrar: (
    ruta: string,
    meta: MetaArchivo,
  ) => Promise<{ error: string } | undefined>;
};

/** Botón para subir un PDF o una imagen directo a Storage. */
export function FileUploader({
  texto,
  preparar,
  registrar,
}: FileUploaderProps) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    const meta: MetaArchivo = {
      nombre: archivo.name,
      tipo: archivo.type,
      tamano: archivo.size,
    };
    const problema = validarArchivo(meta);
    if (problema) return setError(problema);

    setError(null);
    setSubiendo(true);
    try {
      const permiso = await preparar(meta);
      if ("error" in permiso) return setError(permiso.error);

      const { error: errorSubida } = await createClient()
        .storage.from(permiso.bucket)
        .uploadToSignedUrl(permiso.ruta, permiso.token, archivo, {
          contentType: archivo.type,
        });
      if (errorSubida)
        return setError("No se pudo subir el archivo. Revisa tu conexión.");

      const resultado = await registrar(permiso.ruta, meta);
      if (resultado?.error) return setError(resultado.error);
      router.refresh();
    } catch {
      setError("No se pudo subir el archivo. Intenta de nuevo.");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        aria-disabled={subiendo}
        className={buttonVariants({
          variant: "outline",
          className: `h-9 w-fit cursor-pointer ${subiendo ? "pointer-events-none opacity-50" : ""}`,
        })}
      >
        {subiendo ? "Subiendo…" : texto}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACEPTA}
        className="sr-only"
        disabled={subiendo}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) void subir(archivo);
        }}
      />
      <p className="text-xs text-muted-foreground">
        PDF o imagen, hasta 10 MB.
      </p>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
