"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarOrdenCompra } from "@/lib/contratos/campos";
import type { Campo, Valores } from "@/lib/forms/campos";
import { eliminarOrdenCompra, guardarOrdenCompra } from "./actions";

type Props = {
  contratoId: string;
  /** Vacío al crear. */
  ordenId: string | null;
  campos: Campo[];
  valores: Valores;
};

export function OrdenCompraForm({
  contratoId,
  ordenId,
  campos,
  valores,
}: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={ordenId !== null}
      validar={validarOrdenCompra}
      guardar={(v) => guardarOrdenCompra(contratoId, ordenId, v)}
      cancelarHref={`/contratos/${contratoId}`}
      textoGuardar={ordenId ? "Guardar cambios" : "Agregar orden de compra"}
      eliminar={
        ordenId ? () => eliminarOrdenCompra(contratoId, ordenId) : undefined
      }
      confirmarEliminar="¿Eliminar esta orden de compra? Las tarifas que cubría quedarán sin orden."
    />
  );
}
