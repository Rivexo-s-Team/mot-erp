"use client";

import { ConfigForm } from "@/components/forms/config-form";
import type { Campo, Valores } from "@/lib/forms/campos";
import { validarOrden } from "@/lib/ordenes/campos";
import { eliminarOrden, guardarOrden } from "./actions";

type Props = {
  /** Vacío en un trabajo de taller. */
  cuentaId: string | null;
  /** Vacío al crear. */
  ordenId: string | null;
  campos: Campo[];
  valores: Valores;
  cancelarHref: string;
};

export function OrdenForm({
  cuentaId,
  ordenId,
  campos,
  valores,
  cancelarHref,
}: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={ordenId !== null}
      validar={validarOrden}
      guardar={(v) => guardarOrden(cuentaId, ordenId, v)}
      cancelarHref={cancelarHref}
      textoGuardar={ordenId ? "Guardar cambios" : "Crear orden"}
      eliminar={ordenId ? () => eliminarOrden(ordenId) : undefined}
      confirmarEliminar="¿Eliminar esta orden? Hazlo solo si se capturó por error; si la visita no se hizo, mejor cancélala."
    />
  );
}
