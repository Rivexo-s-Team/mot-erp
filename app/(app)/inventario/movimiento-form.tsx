"use client";

import { ConfigForm } from "@/components/forms/config-form";
import type { Campo, Valores } from "@/lib/forms/campos";
import { validarMovimiento } from "@/lib/inventario/campos";
import { registrarMovimiento } from "./actions";

type Props = { campos: Campo[]; valores: Valores; cancelarHref: string };

export function MovimientoForm({ campos, valores, cancelarHref }: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={false}
      validar={validarMovimiento}
      guardar={registrarMovimiento}
      cancelarHref={cancelarHref}
      textoGuardar="Registrar movimiento"
    />
  );
}
