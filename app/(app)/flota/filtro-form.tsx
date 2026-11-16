"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarFiltro } from "@/lib/flota/filtros";
import type { Campo, Valores } from "@/lib/forms/campos";
import { eliminarFiltro, guardarFiltro } from "./filtros-actions";

type Props = {
  roboxId: string;
  /** Vacío al registrar. */
  filtroId: string | null;
  campos: Campo[];
  valores: Valores;
};

export function FiltroForm({ roboxId, filtroId, campos, valores }: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={filtroId !== null}
      validar={validarFiltro}
      guardar={(v) => guardarFiltro(roboxId, filtroId, v)}
      cancelarHref={`/flota/${roboxId}`}
      textoGuardar={filtroId ? "Guardar cambios" : "Registrar filtro"}
      eliminar={filtroId ? () => eliminarFiltro(roboxId, filtroId) : undefined}
      confirmarEliminar="¿Eliminar este registro? Hazlo solo si se capturó por error; si el filtro ya se cambió, mejor pon la fecha en que se retiró."
    />
  );
}
