"use client";

import { useRef, useState } from "react";
import { FirmaVista, puntosDeTrazo } from "@/components/firma-vista";
import { Button } from "@/components/ui/button";
import { LIENZO_FIRMA } from "@/lib/ordenes/captura";

type Props = {
  /** Texto para lectores de pantalla y pruebas, ej. "Firma del técnico". */
  etiqueta: string;
  trazos: number[][];
  onChange: (trazos: number[][]) => void;
};

/**
 * Recuadro para firmar con el dedo, el lápiz o el ratón. Guarda los trazos
 * como puntos dentro del lienzo, sin importar el tamaño de la pantalla.
 */
export function FirmaPad({ etiqueta, trazos, onChange }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  // El trazo que se está dibujando; al soltar pasa a `trazos`.
  const [actual, setActual] = useState<number[] | null>(null);

  const punto = (e: React.PointerEvent): [number, number] => {
    const r = caja.current?.getBoundingClientRect();
    if (!r || r.width === 0) return [0, 0];
    const limitar = (v: number, max: number) =>
      Math.min(max, Math.max(0, Math.round(v)));
    return [
      limitar(
        ((e.clientX - r.left) / r.width) * LIENZO_FIRMA.ancho,
        LIENZO_FIRMA.ancho,
      ),
      limitar(
        ((e.clientY - r.top) / r.height) * LIENZO_FIRMA.alto,
        LIENZO_FIRMA.alto,
      ),
    ];
  };

  return (
    <div className="space-y-2">
      <div
        ref={caja}
        role="img"
        aria-label={etiqueta}
        data-firmada={trazos.length > 0}
        className="relative w-full touch-none rounded-lg border-2 border-dashed border-input bg-background select-none"
        style={{
          aspectRatio: `${LIENZO_FIRMA.ancho} / ${LIENZO_FIRMA.alto}`,
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setActual(punto(e));
        }}
        onPointerMove={(e) => {
          if (!actual) return;
          const [x, y] = punto(e);
          // Se ignoran los puntos repetidos para que la firma pese poco.
          if (x === actual.at(-2) && y === actual.at(-1)) return;
          if (actual.length >= 4000) return;
          setActual([...actual, x, y]);
        }}
        onPointerUp={() => {
          if (actual) onChange([...trazos, actual]);
          setActual(null);
        }}
        onPointerCancel={() => setActual(null)}
      >
        <FirmaVista
          trazos={trazos}
          className="pointer-events-none absolute inset-0 size-full"
        />
        {actual ? (
          <svg
            viewBox={`0 0 ${LIENZO_FIRMA.ancho} ${LIENZO_FIRMA.alto}`}
            className="pointer-events-none absolute inset-0 size-full"
            aria-hidden
          >
            <polyline
              points={puntosDeTrazo(actual)}
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
        {trazos.length === 0 && !actual ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Firma aquí con el dedo
          </p>
        ) : null}
      </div>
      {trazos.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([])}
        >
          Borrar firma
        </Button>
      ) : null}
    </div>
  );
}
