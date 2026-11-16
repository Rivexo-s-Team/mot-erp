"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarDocumento } from "@/lib/acceso/documentos";
import type { Campo, Valores } from "@/lib/forms/campos";
import { eliminarDocumento, guardarDocumento } from "./actions";

type Props = {
  /** Vacío al registrar. */
  documentoId: string | null;
  campos: Campo[];
  valores: Valores;
  /** Tipos de documento que son de una persona (para exigirla). */
  tiposDePersona: string[];
};

export function DocumentoForm({
  documentoId,
  campos,
  valores,
  tiposDePersona,
}: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={documentoId !== null}
      validar={
        documentoId === null ? validarDocumento(tiposDePersona) : undefined
      }
      guardar={(v) => guardarDocumento(documentoId, v)}
      cancelarHref="/documentos-acceso"
      textoGuardar={documentoId ? "Guardar cambios" : "Registrar documento"}
      eliminar={documentoId ? () => eliminarDocumento(documentoId) : undefined}
      confirmarEliminar="¿Quitar este documento de la lista? Hazlo si ya se renovó o se capturó por error."
    />
  );
}
