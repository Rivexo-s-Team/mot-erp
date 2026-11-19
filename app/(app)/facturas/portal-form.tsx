"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { CAMPOS_PORTAL, validarPortal } from "@/lib/facturacion/cobranza";
import type { Valores } from "@/lib/forms/campos";
import { guardarPortal } from "./actions";

export function PortalForm({
  facturaId,
  valores,
}: {
  facturaId: string;
  valores: Valores;
}) {
  return (
    <ConfigForm
      campos={CAMPOS_PORTAL}
      valores={valores}
      esEdicion
      validar={validarPortal}
      guardar={(v) => guardarPortal(facturaId, v)}
      cancelarHref={`/facturas/${facturaId}`}
      textoGuardar="Guardar seguimiento"
    />
  );
}
