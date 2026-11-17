"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarCredito } from "@/lib/facturacion/credito";
import type { Campo, Valores } from "@/lib/forms/campos";
import { guardarCredito } from "./actions";

type Props = {
  cuentaId: string;
  razonId: string;
  campos: Campo[];
  valores: Valores;
  /** Falso la primera vez que se capturan. */
  existen: boolean;
};

export function CreditoForm({
  cuentaId,
  razonId,
  campos,
  valores,
  existen,
}: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={existen}
      validar={validarCredito}
      guardar={(v) => guardarCredito(cuentaId, razonId, v)}
      cancelarHref={`/clientes/${cuentaId}`}
      textoGuardar="Guardar condiciones"
    />
  );
}
