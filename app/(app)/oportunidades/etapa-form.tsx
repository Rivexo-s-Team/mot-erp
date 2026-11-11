"use client";

import { ConfigForm } from "@/components/forms/config-form";
import type { Valores } from "@/lib/forms/campos";
import { CAMPOS_ETAPA, validarEtapa } from "@/lib/pipeline/campos";
import { cambiarEtapa } from "./actions";

/** Mueve la oportunidad de etapa; al perderla pide el motivo. */
export function EtapaForm({ id, valores }: { id: string; valores: Valores }) {
  return (
    <ConfigForm
      campos={CAMPOS_ETAPA}
      valores={valores}
      esEdicion
      validar={validarEtapa}
      guardar={(v) => cambiarEtapa(id, v)}
      cancelarHref={`/oportunidades/${id}`}
      textoGuardar="Cambiar etapa"
    />
  );
}
