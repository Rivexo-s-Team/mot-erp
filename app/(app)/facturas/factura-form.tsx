"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarFactura } from "@/lib/facturacion/facturas";
import type { Campo, Valores } from "@/lib/forms/campos";
import { eliminarFactura, guardarConcepto, guardarFactura } from "./actions";

type Props = {
  facturaId: string;
  /** Si viene, se edita ese concepto; si no, el encabezado de la factura. */
  conceptoId?: string;
  campos: Campo[];
  valores: Valores;
};

export function FacturaForm({ facturaId, conceptoId, campos, valores }: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion
      validar={conceptoId ? undefined : validarFactura}
      guardar={(v) =>
        conceptoId
          ? guardarConcepto(facturaId, conceptoId, v)
          : guardarFactura(facturaId, v)
      }
      cancelarHref={`/facturas/${facturaId}`}
      textoGuardar="Guardar cambios"
      eliminar={conceptoId ? undefined : () => eliminarFactura(facturaId)}
      confirmarEliminar="¿Eliminar este borrador? Sus cargos vuelven a quedar por facturar."
    />
  );
}
