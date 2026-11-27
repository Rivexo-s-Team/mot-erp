import { formatImporte } from "@/lib/format";
import { escala, importeCorto, nombreMes } from "@/lib/direccion/tablero";

type Mes = { mes: string; facturado_total: number; cobrado: number };

const SERIES = [
  {
    clave: "facturado_total",
    label: "Facturado (con IVA)",
    color: "var(--chart-1)",
  },
  { clave: "cobrado", label: "Cobrado", color: "var(--chart-2)" },
] as const;

// Geometría del lienzo; el SVG se ajusta al ancho disponible.
const ANCHO = 720;
const ALTO = 240;
const M = { arriba: 12, derecha: 8, abajo: 26, izquierda: 44 };

/**
 * Facturado y cobrado por mes, en una sola moneda y un solo eje. Cada barra
 * dice su valor al pasar el cursor o tocarla; la tabla de abajo trae lo mismo
 * en números.
 */
export function BarrasMensuales({
  meses,
  moneda,
}: {
  meses: Mes[];
  moneda: string;
}) {
  const maximo = Math.max(
    0,
    ...meses.flatMap((m) => [m.facturado_total, m.cobrado]),
  );
  const { tope, marcas } = escala(maximo);
  const plotAncho = ANCHO - M.izquierda - M.derecha;
  const plotAlto = ALTO - M.arriba - M.abajo;
  const banda = plotAncho / meses.length;
  const barra = Math.min(18, (banda - 10) / 2);
  const y = (v: number) => M.arriba + plotAlto - (v / tope) * plotAlto;

  return (
    <figure className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {SERIES.map((s) => (
          <li key={s.clave} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-xs"
              style={{ background: s.color }}
            />
            {s.label}
          </li>
        ))}
      </ul>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label={`Facturado y cobrado por mes en ${moneda}`}
        className="h-auto w-full"
      >
        {marcas.map((v) => (
          <g key={v}>
            <line
              x1={M.izquierda}
              x2={ANCHO - M.derecha}
              y1={y(v)}
              y2={y(v)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={M.izquierda - 6}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {importeCorto(v)}
            </text>
          </g>
        ))}
        {meses.map((m, i) => {
          const centro = M.izquierda + banda * i + banda / 2;
          return (
            <g key={m.mes}>
              {SERIES.map((s, j) => {
                const valor = m[s.clave];
                const alto = (valor / tope) * plotAlto;
                // 2 px de separación entre las dos barras del mes.
                const x = centro + (j === 0 ? -barra - 1 : 1);
                return (
                  <g key={s.clave}>
                    {alto > 0 ? (
                      <path
                        d={barraRedondeada(x, y(valor), barra, alto)}
                        fill={s.color}
                      />
                    ) : null}
                    {/* Zona sensible más grande que la barra. */}
                    <rect
                      x={x}
                      y={M.arriba}
                      width={barra}
                      height={plotAlto}
                      fill="transparent"
                    >
                      <title>{`${nombreMes(m.mes)} · ${s.label}: ${formatImporte(valor, moneda)}`}</title>
                    </rect>
                  </g>
                );
              })}
              <text
                x={centro}
                y={ALTO - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {nombreMes(m.mes)}
              </text>
            </g>
          );
        })}
      </svg>
      <details className="text-sm">
        <summary className="cursor-pointer text-primary underline-offset-4 hover:underline">
          Ver en tabla
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-96 text-sm tabular-nums">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 pr-4 font-medium">
                  Mes
                </th>
                {SERIES.map((s) => (
                  <th
                    key={s.clave}
                    scope="col"
                    className="py-1.5 pl-4 text-right font-medium"
                  >
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {meses.map((m) => (
                <tr key={m.mes}>
                  <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                    {nombreMes(m.mes)}
                  </th>
                  {SERIES.map((s) => (
                    <td key={s.clave} className="py-1.5 pl-4 text-right">
                      {formatImporte(m[s.clave], moneda)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Barra con las esquinas de arriba redondeadas (4 px) y la base recta. */
function barraRedondeada(x: number, y: number, ancho: number, alto: number) {
  const r = Math.min(4, alto, ancho / 2);
  return `M${x},${y + alto}V${y + r}Q${x},${y} ${x + r},${y}H${x + ancho - r}Q${x + ancho},${y} ${x + ancho},${y + r}V${y + alto}Z`;
}
