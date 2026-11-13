import { LIENZO_FIRMA, puntosDeTrazo } from "@/lib/ordenes/captura";

/** Dibuja una firma guardada. Sirve en el servidor y en el navegador. */
export function FirmaVista({
  trazos,
  className,
}: {
  trazos: number[][];
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${LIENZO_FIRMA.ancho} ${LIENZO_FIRMA.alto}`}
      role="img"
      aria-label="Firma"
      className={className}
    >
      {trazos.map((t, i) => (
        <polyline
          key={i}
          points={puntosDeTrazo(t)}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
