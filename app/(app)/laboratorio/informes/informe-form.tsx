"use client";

import { ConfigForm } from "@/components/forms/config-form";
import type { Campo, Valores } from "@/lib/forms/campos";
import { crearInforme, eliminarInforme, guardarInforme } from "./actions";

type Props = {
  /** Al crear: el cliente. Al editar: el informe. */
  modo: { cuentaId: string } | { informeId: string };
  campos: Campo[];
  valores: Valores;
  cancelarHref: string;
};

export function InformeForm({ modo, campos, valores, cancelarHref }: Props) {
  const informeId = "informeId" in modo ? modo.informeId : null;
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={informeId !== null}
      guardar={(v) =>
        "informeId" in modo
          ? guardarInforme(modo.informeId, v)
          : crearInforme(modo.cuentaId, v)
      }
      cancelarHref={cancelarHref}
      textoGuardar={informeId ? "Guardar cambios" : "Crear informe"}
      eliminar={informeId ? () => eliminarInforme(informeId) : undefined}
      confirmarEliminar="¿Eliminar este informe en borrador? Las muestras y sus resultados no se tocan."
    />
  );
}
