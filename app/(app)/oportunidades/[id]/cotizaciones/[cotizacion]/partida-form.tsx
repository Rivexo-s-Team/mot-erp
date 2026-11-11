"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarPartida } from "@/lib/cotizaciones/campos";
import {
  comoPorcentaje,
  precioSugeridoPorLitro,
  type ParametrosCotizador,
} from "@/lib/cotizaciones/cotizador";
import type { Campo, Valores } from "@/lib/forms/campos";
import { eliminarPartida, guardarPartida } from "../../../cotizaciones-actions";

type Props = {
  oportunidadId: string;
  cotizacionId: string;
  /** null = partida nueva. */
  id: string | null;
  campos: Campo[];
  valores: Valores;
  moneda: string;
  tipoCambio: number | null;
  /** Porcentaje y piso vigentes; null si no se pudieron leer. */
  parametros: ParametrosCotizador | null;
};

export function PartidaForm({
  oportunidadId,
  cotizacionId,
  id,
  campos,
  valores,
  moneda,
  tipoCambio,
  parametros,
}: Props) {
  /** Muestra, mientras se escribe, el precio que sugiere el cotizador por litro. */
  function ayudaDinamica(v: Valores) {
    if (!parametros || v.unidad !== "litro") return {};
    const referencia = String(v.precio_referencia ?? "").trim();
    if (referencia === "") return {};
    const s = precioSugeridoPorLitro(
      referencia,
      parametros,
      moneda,
      tipoCambio,
    );
    if (!s) {
      return {
        precio_unitario:
          moneda !== parametros.monedaPiso
            ? "Para sugerir un precio falta el tipo de cambio en los datos de la cotización."
            : "",
      };
    }
    const porcentaje = comoPorcentaje(parametros.porcentaje);
    const detalle = s.aplicoPiso
      ? `aplica el mínimo, porque el ${porcentaje} de ${referencia} sería ${s.porPorcentaje}`
      : `${porcentaje} de ${referencia}; el mínimo es ${s.pisoEnMoneda}`;
    return {
      precio_unitario: `Precio sugerido: ${s.precio} ${moneda} por litro (${detalle}). Déjalo vacío para usarlo, o escribe otro.`,
    };
  }

  const base = `/oportunidades/${oportunidadId}/cotizaciones/${cotizacionId}`;
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={id !== null}
      validar={validarPartida}
      ayudaDinamica={ayudaDinamica}
      guardar={(v) => guardarPartida(oportunidadId, cotizacionId, id, v)}
      cancelarHref={base}
      textoGuardar={id ? "Guardar cambios" : "Agregar partida"}
      eliminar={
        id ? () => eliminarPartida(oportunidadId, cotizacionId, id) : undefined
      }
      confirmarEliminar="¿Eliminar esta partida?"
    />
  );
}
