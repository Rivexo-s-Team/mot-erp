"use client";

import { ConfigForm } from "@/components/forms/config-form";
import {
  CAMPOS_COTIZACION,
  validarCotizacion,
} from "@/lib/cotizaciones/campos";
import type { Valores } from "@/lib/forms/campos";
import {
  eliminarCotizacion,
  guardarCotizacion,
} from "../../../cotizaciones-actions";

type Props = { oportunidadId: string; cotizacionId: string; valores: Valores };

export function CotizacionForm({
  oportunidadId,
  cotizacionId,
  valores,
}: Props) {
  return (
    <ConfigForm
      campos={CAMPOS_COTIZACION}
      valores={valores}
      esEdicion
      validar={validarCotizacion}
      guardar={(v) => guardarCotizacion(oportunidadId, cotizacionId, v)}
      cancelarHref={`/oportunidades/${oportunidadId}/cotizaciones/${cotizacionId}`}
      textoGuardar="Guardar cambios"
      eliminar={() => eliminarCotizacion(oportunidadId, cotizacionId)}
      confirmarEliminar="¿Eliminar esta cotización con todas sus partidas?"
    />
  );
}
