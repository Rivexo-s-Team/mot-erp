"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarCotizacion } from "@/lib/cotizaciones/campos";
import type { Campo, Valores } from "@/lib/forms/campos";
import {
  eliminarCotizacion,
  guardarCotizacion,
} from "../../../cotizaciones-actions";

type Props = {
  oportunidadId: string;
  cotizacionId: string;
  campos: Campo[];
  valores: Valores;
};

export function CotizacionForm({
  oportunidadId,
  cotizacionId,
  campos,
  valores,
}: Props) {
  return (
    <ConfigForm
      campos={campos}
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
