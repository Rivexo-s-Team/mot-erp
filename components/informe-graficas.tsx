"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDia } from "@/lib/format";
import {
  formatoEje,
  trazar,
  type Caja,
  type GrupoTendencias,
  type SerieTendencia,
} from "@/lib/laboratorio/graficas";

type MuestraEje = { idMuestra: string; fecha: string };

type Props = { grupos: GrupoTendencias[]; muestras: MuestraEje[] };

const CAJA: Caja = {
  ancho: 300,
  alto: 132,
  margen: { arriba: 10, derecha: 12, abajo: 22, izquierda: 44 },
};

/** dd/mm/aa, para que quepa en el eje. */
const fechaCorta = (dia: string) => {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a?.slice(2)}`;
};

/**
 * Gráficas de tendencia del informe: una pequeña por parámetro. Al pasar el
 * cursor (o tocar) un punto, arriba se lee su valor y de qué muestra es.
 */
export function InformeGraficas({ grupos, muestras }: Props) {
  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <section key={g.grupo}>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            {g.titulo}
          </h3>
          {g.series.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.series.map((s) => (
                <li key={s.parametroId}>
                  <Grafica serie={s} muestras={muestras} />
                </li>
              ))}
            </ul>
          ) : null}
          {g.enCero.length > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              En cero en todas las muestras: {g.enCero.join(", ")}.
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function Grafica({
  serie,
  muestras,
}: {
  serie: SerieTendencia;
  muestras: MuestraEje[];
}) {
  const trazo = trazar(serie, muestras.length, CAJA);
  const ultimo = trazo.puntos.length - 1;
  // Sin elegir nada se lee la muestra más reciente.
  const [elegido, setElegido] = useState<number | null>(null);
  const punto = trazo.puntos[elegido ?? ultimo];
  const muestra = punto ? muestras[punto.indice] : undefined;
  const { margen } = CAJA;
  const derecha = CAJA.ancho - margen.derecha;
  const abajo = CAJA.alto - margen.abajo;
  const primera = muestras[0];
  const final = muestras.at(-1);
  // Franja que responde al cursor alrededor de cada punto.
  const paso =
    muestras.length > 1
      ? (derecha - margen.izquierda) / (muestras.length - 1)
      : derecha - margen.izquierda;

  return (
    <Card className="gap-1 px-4 py-3">
      <p className="text-sm font-medium">
        {serie.nombre}
        {serie.unidad ? (
          <span className="ml-1 font-normal text-muted-foreground">
            {serie.unidad}
          </span>
        ) : null}
      </p>
      <p
        className="flex min-h-6 flex-wrap items-center gap-x-2 text-sm"
        aria-live="polite"
      >
        <span className="font-medium tabular-nums">{punto?.texto}</span>
        {punto?.veredicto === "no_pasa" ? (
          <Badge variant="destructive">No pasa</Badge>
        ) : null}
        <span className="text-muted-foreground">
          {muestra
            ? `${muestra.idMuestra} · ${formatDia(muestra.fecha)}`
            : null}
        </span>
      </p>
      <svg
        viewBox={`0 0 ${CAJA.ancho} ${CAJA.alto}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Tendencia de ${serie.nombre}: ${trazo.puntos
          .map((p) => `${muestras[p.indice]?.idMuestra ?? ""} ${p.texto}`)
          .join(", ")}.`}
        onMouseLeave={() => setElegido(null)}
      >
        {/* Piso y techo de la escala */}
        {[margen.arriba, abajo].map((y) => (
          <line
            key={y}
            x1={margen.izquierda}
            x2={derecha}
            y1={y}
            y2={y}
            className="stroke-border"
            strokeWidth={1}
          />
        ))}
        <text
          x={margen.izquierda - 6}
          y={margen.arriba + 4}
          textAnchor="end"
          className="fill-muted-foreground text-[10px] tabular-nums"
        >
          {formatoEje(trazo.escala.max)}
        </text>
        <text
          x={margen.izquierda - 6}
          y={abajo + 3}
          textAnchor="end"
          className="fill-muted-foreground text-[10px] tabular-nums"
        >
          {formatoEje(trazo.escala.min)}
        </text>
        {primera ? (
          <text
            x={margen.izquierda}
            y={CAJA.alto - 5}
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {fechaCorta(primera.fecha)}
          </text>
        ) : null}
        {final && muestras.length > 1 ? (
          <text
            x={derecha}
            y={CAJA.alto - 5}
            textAnchor="end"
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {fechaCorta(final.fecha)}
          </text>
        ) : null}

        {/* Límites */}
        {trazo.limites.map((l) => (
          <g key={l.valor}>
            <line
              x1={margen.izquierda}
              x2={derecha}
              y1={l.y}
              y2={l.y}
              className="stroke-muted-foreground"
              strokeWidth={1}
            />
            <text
              x={derecha}
              y={l.y - 3}
              textAnchor="end"
              className="fill-muted-foreground text-[9px] tabular-nums"
            >
              límite {formatoEje(l.valor)}
            </text>
          </g>
        ))}

        {/* Guía del punto elegido */}
        {punto && elegido !== null ? (
          <line
            x1={punto.x}
            x2={punto.x}
            y1={margen.arriba}
            y2={abajo}
            className="stroke-muted-foreground/50"
            strokeWidth={1}
          />
        ) : null}

        {trazo.tramos.map((t, i) => (
          <polyline
            key={i}
            points={t.map((q) => `${q.x},${q.y}`).join(" ")}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {trazo.puntos.map((p, i) => {
          const activo = i === (elegido ?? ultimo);
          // Lo que no pasa va hueco y en rojo: se distingue también sin color.
          const falla = p.veredicto === "no_pasa";
          return (
            <circle
              key={p.indice}
              cx={p.x}
              cy={p.y}
              r={activo ? 5 : 4}
              strokeWidth={2}
              className={
                falla
                  ? "fill-card stroke-destructive"
                  : "fill-primary stroke-card"
              }
            />
          );
        })}
        {trazo.puntos.map((p, i) => (
          <rect
            key={p.indice}
            x={p.x - paso / 2}
            y={0}
            width={paso}
            height={CAJA.alto}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${muestras[p.indice]?.idMuestra ?? ""}: ${p.texto}${p.veredicto === "no_pasa" ? ", no pasa" : ""}`}
            className="cursor-pointer outline-none focus-visible:stroke-ring"
            onMouseEnter={() => setElegido(i)}
            onFocus={() => setElegido(i)}
            onBlur={() => setElegido(null)}
            onClick={() => setElegido(i)}
          />
        ))}
      </svg>
      {serie.limite ? (
        <p className="text-xs text-muted-foreground">Límite {serie.limite}</p>
      ) : null}
    </Card>
  );
}
