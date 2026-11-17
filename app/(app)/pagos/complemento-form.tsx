"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { CAMPOS_COMPLEMENTO } from "@/lib/facturacion/pagos";
import type { Valores } from "@/lib/forms/campos";
import { guardarComplemento } from "./actions";

export function ComplementoForm({
  pagoId,
  valores,
}: {
  pagoId: string;
  valores: Valores;
}) {
  return (
    <ConfigForm
      campos={CAMPOS_COMPLEMENTO}
      valores={valores}
      esEdicion
      guardar={(v) => guardarComplemento(pagoId, v)}
      cancelarHref={`/pagos/${pagoId}`}
      textoGuardar="Guardar complemento"
    />
  );
}
