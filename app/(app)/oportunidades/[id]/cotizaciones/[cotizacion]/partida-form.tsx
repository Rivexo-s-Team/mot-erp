"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { validarPartida } from "@/lib/cotizaciones/campos";
import {
  comoPorcentaje,
  precioReferenciaDeContenedor,
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
  /** Muestra, mientras se escribe, lo que calcula el cotizador por litro. */
  function ayudaDinamica(v: Valores) {
    if (!parametros || v.unidad !== "litro") return {};
    const ayudas: Record<string, string> = {};

    // Con costo y litros del contenedor, el precio de referencia se calcula solo.
    const deContenedor = precioReferenciaDeContenedor(
      String(v.referencia_costo_contenedor ?? ""),
      String(v.referencia_litros_contenedor ?? ""),
    );
    if (deContenedor) {
      ayudas.referencia_litros_contenedor = `Precio del aceite nuevo: ${deContenedor} ${moneda} por litro.`;
    }
    const referencia = deContenedor ?? String(v.precio_referencia ?? "").trim();
    if (referencia === "") return ayudas;

    const s = precioSugeridoPorLitro(
      referencia,
      parametros,
      moneda,
      tipoCambio,
    );
    if (!s) {
      if (moneda !== parametros.monedaPiso) {
        ayudas.precio_unitario =
          "Para sugerir un precio falta el tipo de cambio en los datos de la cotización.";
      }
      return ayudas;
    }
    const porcentaje = comoPorcentaje(parametros.porcentaje);
    const detalle = s.aplicoPiso
      ? `aplica el mínimo, porque el ${porcentaje} de ${referencia} sería ${s.porPorcentaje}`
      : `${porcentaje} de ${referencia}; el mínimo es ${s.pisoEnMoneda}`;
    ayudas.precio_unitario = `Precio sugerido: ${s.precio} ${moneda} por litro (${detalle}). Déjalo vacío para usarlo, o escribe otro.`;
    return ayudas;
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
