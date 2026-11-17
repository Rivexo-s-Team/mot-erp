"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarEmision, validarFactura } from "@/lib/facturacion/facturas";
import type { Campo, Valores } from "@/lib/forms/campos";
import {
  cancelarFactura,
  eliminarFactura,
  guardarConcepto,
  guardarFactura,
  registrarEmision,
} from "./actions";

type Props = {
  facturaId: string;
  /**
   * Qué se captura: el encabezado del borrador, un concepto, el registro de
   * la factura ya timbrada o su cancelación.
   */
  modo:
    | { tipo: "encabezado" }
    | { tipo: "concepto"; conceptoId: string }
    | { tipo: "emision"; yaEmitida: boolean }
    | { tipo: "cancelacion" };
  campos: Campo[];
  valores: Valores;
};

export function FacturaForm({ facturaId, modo, campos, valores }: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={modo.tipo !== "cancelacion"}
      validar={
        modo.tipo === "encabezado"
          ? validarFactura
          : modo.tipo === "emision"
            ? validarEmision
            : undefined
      }
      guardar={(v) =>
        modo.tipo === "concepto"
          ? guardarConcepto(facturaId, modo.conceptoId, v)
          : modo.tipo === "emision"
            ? registrarEmision(facturaId, v)
            : modo.tipo === "cancelacion"
              ? cancelarFactura(facturaId, v)
              : guardarFactura(facturaId, v)
      }
      cancelarHref={`/facturas/${facturaId}`}
      textoGuardar={
        modo.tipo === "emision"
          ? modo.yaEmitida
            ? "Corregir registro"
            : "Registrar como emitida"
          : modo.tipo === "cancelacion"
            ? "Cancelar la factura"
            : "Guardar cambios"
      }
      eliminar={
        modo.tipo === "encabezado"
          ? () => eliminarFactura(facturaId)
          : undefined
      }
      confirmarEliminar="¿Eliminar este borrador? Sus cargos vuelven a quedar por facturar."
    />
  );
}
