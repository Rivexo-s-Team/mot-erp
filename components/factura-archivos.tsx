"use client";

import { FileUploader } from "@/components/forms/file-uploader";
import { ARCHIVOS_PDF, ARCHIVOS_XML } from "@/lib/archivos/config";
import {
  prepararArchivoFactura,
  registrarArchivoFactura,
} from "@/app/(app)/facturas/actions";

type Props = { facturaId: string; tipo: "xml" | "pdf" };

/** Botón para subir el XML o el PDF de una factura emitida (una sola vez cada uno). */
export function SubirArchivoFactura({ facturaId, tipo }: Props) {
  return (
    <FileUploader
      texto={tipo === "xml" ? "Subir XML" : "Subir PDF"}
      acepta={
        tipo === "xml" ? ".xml,text/xml,application/xml" : "application/pdf"
      }
      aceptados={tipo === "xml" ? ARCHIVOS_XML : ARCHIVOS_PDF}
      ayuda={
        tipo === "xml"
          ? "El XML timbrado. Se revisa que sea el de esta factura."
          : "El PDF de la factura, hasta 10 MB."
      }
      preparar={(meta) => prepararArchivoFactura(facturaId, tipo, meta)}
      registrar={(ruta, meta) =>
        registrarArchivoFactura(facturaId, tipo, ruta, meta)
      }
    />
  );
}
