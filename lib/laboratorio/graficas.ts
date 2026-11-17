import { leerValor, type Veredicto } from "./evaluacion";
import type { ContenidoInforme } from "./informe";

/**
 * Gráficas de tendencia del informe (DISENO §4.5): una gráfica pequeña por
 * parámetro, con las muestras en orden de fecha. Aquí solo se calculan los
 * números y la geometría; el dibujo va aparte (pantalla y PDF usan lo mismo).
 *
 * Cada parámetro va en su propia gráfica porque sus escalas son muy distintas
 * (partículas en millones, metales en decenas): juntos, los chicos se verían
 * planos, y dos ejes en una misma gráfica se prestan a leerla mal.
 */

export type PuntoSerie = {
  /** Posición de la muestra en el informe (0 = la más antigua). */
  indice: number;
  /** Como lo escribió el laboratorio ("<300"). */
  texto: string;
  valor: number;
  veredicto: Veredicto;
};

export type SerieTendencia = {
  parametroId: string;
  nombre: string;
  unidad: string | null;
  /** Límite como se lee en el informe. */
  limite: string | null;
  limites: number[];
  /** Solo las muestras con un valor numérico. */
  puntos: PuntoSerie[];
};

export type GrupoTendencias = {
  grupo: string;
  titulo: string;
  series: SerieTendencia[];
  /** Parámetros en cero en todas las muestras: se nombran, no se grafican. */
  enCero: string[];
};

/**
 * Qué se grafica: los parámetros con al menos dos valores numéricos. Los que
 * dan 0 en todas las muestras no llevan gráfica (sería una línea plana).
 */
export function seriesDeTendencia(
  contenido: ContenidoInforme,
): GrupoTendencias[] {
  return contenido.grupos
    .map((g) => {
      const series: SerieTendencia[] = [];
      const enCero: string[] = [];
      for (const f of g.filas) {
        const puntos = f.valores.flatMap((v, indice): PuntoSerie[] => {
          const { numero } = leerValor(v?.texto);
          return v && numero !== null
            ? [
                {
                  indice,
                  texto: v.texto,
                  valor: numero,
                  veredicto: v.veredicto,
                },
              ]
            : [];
        });
        if (puntos.length < 2) continue;
        if (puntos.every((p) => p.valor === 0)) {
          enCero.push(f.nombre);
          continue;
        }
        series.push({
          parametroId: f.parametroId,
          nombre: f.nombre,
          unidad: f.unidad,
          limite: f.limite,
          limites: f.limites ?? [],
          puntos,
        });
      }
      return { grupo: g.grupo, titulo: g.titulo, series, enCero };
    })
    .filter((g) => g.series.length > 0 || g.enCero.length > 0);
}

/** Un número "redondo" (1, 2 o 5 × 10ⁿ) igual o mayor que el dado. */
function redondoArriba(n: number): number {
  if (n <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(n));
  const fraccion = n / potencia;
  const paso = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;
  return Number((paso * potencia).toPrecision(12));
}

export type Escala = { min: number; max: number; limites: number[] };

/**
 * Eje vertical de una serie. Parte de cero, salvo que los valores estén muy
 * juntos y lejos de cero (viscosidad entre 46 y 47): ahí se acerca para que se vea el
 * cambio. Un límite muy por encima de los datos no se dibuja, porque aplastaría
 * la línea contra el piso; el texto del límite se muestra de todos modos.
 */
export function escalaDe(serie: SerieTendencia): Escala {
  const valores = serie.puntos.map((p) => p.valor);
  const maxDatos = Math.max(...valores);
  const limites = serie.limites.filter(
    (l) => l <= Math.max(maxDatos * 4, Number.EPSILON),
  );
  const todos = [...valores, ...limites];
  const lo = Math.min(...todos);
  const hi = Math.max(...todos);
  if (lo > 0 && lo > hi * 0.8) {
    const margen = Math.max((hi - lo) * 0.25, hi * 0.02);
    return {
      min: Number((lo - margen).toPrecision(4)),
      max: Number((hi + margen).toPrecision(4)),
      limites,
    };
  }
  return { min: 0, max: redondoArriba(hi), limites };
}

export type Trazo = {
  /** Tramos de línea: se corta donde falta una muestra intermedia. */
  tramos: { x: number; y: number }[][];
  puntos: (PuntoSerie & { x: number; y: number })[];
  /** Altura de cada límite que cabe en la escala. */
  limites: { valor: number; y: number }[];
  escala: Escala;
};

export type Caja = {
  ancho: number;
  alto: number;
  /** Espacio alrededor del área de datos. */
  margen: { arriba: number; derecha: number; abajo: number; izquierda: number };
};

/** Posiciones de una serie dentro de una caja, para dibujarla como SVG. */
export function trazar(
  serie: SerieTendencia,
  totalMuestras: number,
  caja: Caja,
): Trazo {
  const escala = escalaDe(serie);
  const { margen } = caja;
  const anchoUtil = caja.ancho - margen.izquierda - margen.derecha;
  const altoUtil = caja.alto - margen.arriba - margen.abajo;
  const r = (n: number) => Number(n.toFixed(2));
  const x = (indice: number) =>
    r(
      margen.izquierda +
        (totalMuestras <= 1
          ? anchoUtil / 2
          : (indice / (totalMuestras - 1)) * anchoUtil),
    );
  const y = (valor: number) =>
    r(
      margen.arriba +
        altoUtil -
        ((valor - escala.min) / (escala.max - escala.min || 1)) * altoUtil,
    );

  const puntos = serie.puntos.map((p) => ({
    ...p,
    x: x(p.indice),
    y: y(p.valor),
  }));
  const tramos: { x: number; y: number }[][] = [];
  let anterior: number | null = null;
  for (const p of puntos) {
    if (anterior !== null && p.indice === anterior + 1)
      tramos.at(-1)?.push({ x: p.x, y: p.y });
    else tramos.push([{ x: p.x, y: p.y }]);
    anterior = p.indice;
  }
  return {
    // Un punto suelto no es una línea: solo se dibuja su marca.
    tramos: tramos.filter((t) => t.length > 1),
    puntos,
    limites: escala.limites.map((valor) => ({ valor, y: y(valor) })),
    escala,
  };
}

/** Número corto para el eje: 1,831,620 → "1.83 M"; 0.583 → "0.583". */
export function formatoEje(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Number((n / 1_000_000).toPrecision(3))} M`;
  if (abs >= 10_000) return `${Number((n / 1000).toPrecision(3))} k`;
  return String(Number(n.toPrecision(4)));
}
