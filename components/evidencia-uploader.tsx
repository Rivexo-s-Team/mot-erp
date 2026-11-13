"use client";

import { useId, useState } from "react";
import { FileUploader } from "@/components/forms/file-uploader";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ACEPTA_IMAGENES, TIPOS_EVIDENCIA } from "@/lib/archivos/config";
import {
  prepararEvidencia,
  registrarEvidencia,
} from "@/app/(app)/ordenes/evidencias-actions";

/** Elige qué muestra la foto y la sube (desde la cámara o la galería del teléfono). */
export function EvidenciaUploader({ ordenId }: { ordenId: string }) {
  const id = useId();
  const [tipo, setTipo] = useState<string>(TIPOS_EVIDENCIA[0].value);

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
      <label htmlFor={id} className="text-sm font-medium">
        Agregar foto de
      </label>
      <NativeSelect
        id={id}
        name="tipo_evidencia"
        className="h-11 w-full"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
      >
        {TIPOS_EVIDENCIA.map((t) => (
          <NativeSelectOption key={t.value} value={t.value}>
            {t.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FileUploader
        texto="Tomar o elegir foto"
        acepta={ACEPTA_IMAGENES}
        ayuda="Solo fotos, hasta 10 MB. Se necesita señal para subirlas."
        preparar={(meta) => prepararEvidencia(ordenId, meta)}
        registrar={(ruta, meta) =>
          registrarEvidencia(ordenId, tipo, ruta, meta)
        }
      />
    </div>
  );
}
