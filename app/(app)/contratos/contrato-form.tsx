"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarContrato } from "@/lib/contratos/campos";
import type { Campo, Valores } from "@/lib/forms/campos";
import { eliminarContrato, guardarContrato } from "./actions";

type Props = {
  cuentaId: string;
  /** Vacío al crear. */
  contratoId: string | null;
  /** Oportunidad ganada de la que nace, si se crea desde una. */
  oportunidadId: string | null;
  campos: Campo[];
  valores: Valores;
  cancelarHref: string;
};

export function ContratoForm({
  cuentaId,
  contratoId,
  oportunidadId,
  campos,
  valores,
  cancelarHref,
}: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={contratoId !== null}
      validar={validarContrato}
      guardar={(v) => guardarContrato(cuentaId, contratoId, oportunidadId, v)}
      cancelarHref={cancelarHref}
      textoGuardar={contratoId ? "Guardar cambios" : "Crear contrato"}
      eliminar={contratoId ? () => eliminarContrato(contratoId) : undefined}
      confirmarEliminar="¿Eliminar este contrato de la lista? Si ya terminó o se canceló, mejor cámbiale el estado."
    />
  );
}
