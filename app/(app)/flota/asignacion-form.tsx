"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarAsignacion } from "@/lib/flota/campos";
import type { Campo, Valores } from "@/lib/forms/campos";
import {
  asignarRobox,
  eliminarAsignacion,
  guardarAsignacion,
} from "./asignaciones-actions";

type Props = {
  roboxId: string;
  /** Vacío al asignar. */
  asignacionId: string | null;
  campos: Campo[];
  valores: Valores;
};

export function AsignacionForm({
  roboxId,
  asignacionId,
  campos,
  valores,
}: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={asignacionId !== null}
      validar={validarAsignacion}
      guardar={(v) =>
        asignacionId
          ? guardarAsignacion(roboxId, asignacionId, v)
          : asignarRobox(roboxId, v)
      }
      cancelarHref={`/flota/${roboxId}`}
      textoGuardar={asignacionId ? "Guardar cambios" : "Asignar Robox"}
      eliminar={
        asignacionId
          ? () => eliminarAsignacion(roboxId, asignacionId)
          : undefined
      }
      confirmarEliminar="¿Eliminar esta asignación? Hazlo solo si se capturó por error; si el Robox ya salió del cliente, mejor pon la fecha de término."
    />
  );
}
