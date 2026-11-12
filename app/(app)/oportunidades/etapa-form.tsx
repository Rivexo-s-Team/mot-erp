"use client";

import { ConfigForm } from "@/components/forms/config-form";
import type { Campo, Valores } from "@/lib/forms/campos";
import { validarEtapa } from "@/lib/pipeline/campos";
import { cambiarEtapa } from "./actions";

/** Mueve la oportunidad de etapa; al perderla pide el motivo. */
export function EtapaForm({
  id,
  campos,
  valores,
}: {
  id: string;
  campos: Campo[];
  valores: Valores;
}) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion
      validar={validarEtapa}
      guardar={(v) => cambiarEtapa(id, v)}
      cancelarHref={`/oportunidades/${id}`}
      textoGuardar="Cambiar etapa"
    />
  );
}
