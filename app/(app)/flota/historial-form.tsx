"use client";

import { ConfigForm } from "@/components/forms/config-form";
import type { Campo, Valores } from "@/lib/forms/campos";
import { registrarMovimientoDeAlmacen } from "./historial-actions";

type Props = { roboxId: string; campos: Campo[]; valores: Valores };

export function HistorialForm({ roboxId, campos, valores }: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={false}
      guardar={(v) => registrarMovimientoDeAlmacen(roboxId, v)}
      cancelarHref={`/flota/${roboxId}`}
      textoGuardar="Registrar movimiento"
    />
  );
}
