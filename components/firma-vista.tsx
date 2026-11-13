import { LIENZO_FIRMA } from "@/lib/ordenes/captura";

/** Puntos de un trazo ([x1, y1, x2, y2, …]) en el formato de un polyline de SVG. */
export function puntosDeTrazo(trazo: number[]): string {
  const pares: string[] = [];
  for (let i = 0; i + 1 < trazo.length; i += 2)
    pares.push(`${trazo[i]},${trazo[i + 1]}`);
  // Un toque sin arrastre se dibuja como un punto.
  if (pares.length === 1 && pares[0]) pares.push(pares[0]);
  return pares.join(" ");
}

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
