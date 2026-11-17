import {
  evaluarMuestra,
  leerValor,
  type Condicion,
  type ContextoMuestra,
  type ResumenCondicion,
  type Umbrales,
  type Veredicto,
} from "./evaluacion";
import { GRUPOS_PARAMETRO, type ParametroLab } from "./resultados";

/**
 * Informe de laboratorio por equipo (DISENO §4.5): arma lo que dice el informe
 * a partir de las muestras y sus resultados. Sin base ni navegador. Lo que
 * devuelve es lo que se guarda fijo al validar (`informes.contenido`).
 */

export const ESTADOS_INFORME = [
  { value: "borrador", label: "Borrador" },
  { value: "validado", label: "Validado" },
];

export type MuestraDeInforme = {
  id: string;
  id_muestra: string;
  tipo: string;
  fecha_muestreo: string;
  nivel_analisis: string | null;
  notas: string | null;
  resultados: Record<string, string>;
};

export type ParametroInforme = ParametroLab & {
  base_comparacion: string | null;
};

export type ColumnaInforme = {
  id: string;
  idMuestra: string;
  tipo: string;
  fecha: string;
  nivel: string | null;
  notas: string | null;
  aceite: ResumenCondicion | null;
  aditivos: ResumenCondicion | null;
};

export type FilaInforme = {
  parametroId: string;
  clave: string;
  nombre: string;
  unidad: string | null;
  limite: string | null;
  /** Un valor por muestra, en el orden de las columnas; vacío si no se midió. */
  valores: ({ texto: string; veredicto: Veredicto } | null)[];
  /** Cambio de la última muestra contra su referencia, como fracción (-0.93 = -93 %). */
  desviacion: number | null;
  /**
   * Límites como números, para dibujarlos en la gráfica: uno si es máximo o
   * mínimo, dos si es un rango. Los informes validados antes de que hubiera
   * gráficas no lo traen.
   */
  limites?: number[];
};

export type ContenidoInforme = {
  version: 1;
  muestras: ColumnaInforme[];
  grupos: { grupo: string; titulo: string; filas: FilaInforme[] }[];
  /** La peor entre la condición del aceite y la de aditivos de la última muestra. */
  condicionGeneral: Condicion | null;
};

const GRAVEDAD: Record<Condicion, number> = {
  normal: 0,
  precaucion: 1,
  critico: 2,
};

/** La más grave de varias condiciones (las vacías no cuentan). */
export function peorCondicion(
  condiciones: (Condicion | null | undefined)[],
): Condicion | null {
  let peor: Condicion | null = null;
  for (const c of condiciones)
    if (c && (peor === null || GRAVEDAD[c] > GRAVEDAD[peor])) peor = c;
  return peor;
}

const porFecha = (a: MuestraDeInforme, b: MuestraDeInforme) =>
  a.fecha_muestreo.localeCompare(b.fecha_muestreo) ||
  a.id_muestra.localeCompare(b.id_muestra);

/** La muestra virgen más reciente que no sea posterior a la fecha dada. */
export function elegirVirgen(
  virgenes: MuestraDeInforme[],
  fecha: string,
): MuestraDeInforme | null {
  return (
    [...virgenes]
      .filter((v) => v.tipo === "virgen" && v.fecha_muestreo <= fecha)
      .sort(porFecha)
      .at(-1) ?? null
  );
}

/** Límite como se lee en el informe; la viscosidad, con el nominal del aceite. */
function textoLimite(p: ParametroLab, nominal: number | null): string | null {
  const n = p.limite_valor;
  switch (p.tipo_regla) {
    case "maximo":
      return `< ${n}`;
    case "minimo":
      return `> ${n}`;
    case "codigo_iso":
      return p.limite_texto;
    case "nominal_pct":
      return nominal === null ? `Nominal ± ${n} %` : `${nominal} ± ${n} %`;
    case "linea_base_abs":
      return `Virgen ± ${n}`;
    case "linea_base_pct":
      return `Virgen ± ${n} %`;
    default:
      return null;
  }
}

/**
 * Límites de un parámetro como números. El rango contra la muestra virgen es
 * el que le toca a la última muestra del informe.
 */
function limitesNumericos(
  p: ParametroLab,
  nominal: number | null,
  virgen: MuestraDeInforme | null,
): number[] {
  const n = p.limite_valor;
  if (n === null) return [];
  const rango = (centro: number, tolerancia: number) => [
    Number((centro - tolerancia).toFixed(6)),
    Number((centro + tolerancia).toFixed(6)),
  ];
  switch (p.tipo_regla) {
    case "maximo":
    case "minimo":
      return [n];
    case "nominal_pct":
      return nominal === null ? [] : rango(nominal, (nominal * n) / 100);
    case "linea_base_abs":
    case "linea_base_pct": {
      const base = leerValor(virgen?.resultados[p.id]);
      if (base.numero === null || base.calificador) return [];
      return rango(
        base.numero,
        p.tipo_regla === "linea_base_abs" ? n : (base.numero * n) / 100,
      );
    }
    default:
      return [];
  }
}

/**
 * Cambio de la última muestra contra su referencia: la muestra de aceite usado
 * o la virgen, según el parámetro. Solo entre números exactos y con una
 * referencia distinta de cero.
 */
function desviacion(
  p: ParametroInforme,
  muestras: MuestraDeInforme[],
): number | null {
  const tipoReferencia =
    p.base_comparacion === "usado_vs_tratado"
      ? "usado"
      : p.base_comparacion === "virgen_vs_tratado"
        ? "virgen"
        : null;
  const ultima = muestras.at(-1);
  const referencia = muestras.findLast((m) => m.tipo === tipoReferencia);
  if (!ultima || !referencia || referencia.id === ultima.id) return null;
  const a = leerValor(ultima.resultados[p.id]);
  const b = leerValor(referencia.resultados[p.id]);
  if (a.numero === null || b.numero === null || a.calificador || b.calificador)
    return null;
  if (b.numero === 0) return null;
  return Number(((a.numero - b.numero) / b.numero).toFixed(6));
}

/**
 * Arma el informe. `virgenes` son todas las muestras virgen del equipo (estén
 * o no en el informe): cada muestra se evalúa contra la que le corresponde.
 */
export function armarInforme(datos: {
  parametros: ParametroInforme[];
  muestras: MuestraDeInforme[];
  virgenes: MuestraDeInforme[];
  nominal: number | null;
  umbrales: Umbrales;
}): ContenidoInforme {
  const muestras = [...datos.muestras].sort(porFecha);
  const evaluaciones = muestras.map((m) => {
    const virgen =
      m.tipo === "virgen"
        ? null
        : elegirVirgen(datos.virgenes, m.fecha_muestreo);
    const ctx: ContextoMuestra = {
      esVirgen: m.tipo === "virgen",
      nominal: datos.nominal,
      base: virgen
        ? { idMuestra: virgen.id_muestra, resultados: virgen.resultados }
        : null,
    };
    return evaluarMuestra(datos.parametros, m.resultados, ctx, datos.umbrales);
  });

  const ultimaMuestra = muestras.at(-1);
  const virgenDeLaUltima =
    ultimaMuestra && ultimaMuestra.tipo !== "virgen"
      ? elegirVirgen(datos.virgenes, ultimaMuestra.fecha_muestreo)
      : null;

  const grupos = GRUPOS_PARAMETRO.map((g) => ({
    grupo: g.value as string,
    titulo: g.label as string,
    filas: datos.parametros
      .filter(
        (p) => p.grupo === g.value && muestras.some((m) => m.resultados[p.id]),
      )
      .map((p) => ({
        parametroId: p.id,
        clave: p.clave,
        nombre: p.nombre,
        unidad: p.unidad,
        limite: textoLimite(p, datos.nominal),
        valores: muestras.map((m, i) => {
          const texto = m.resultados[p.id];
          return texto
            ? {
                texto,
                veredicto:
                  evaluaciones[i]?.porParametro[p.id]?.veredicto ??
                  "sin_evaluar",
              }
            : null;
        }),
        desviacion: desviacion(p, muestras),
        limites: limitesNumericos(p, datos.nominal, virgenDeLaUltima),
      })),
  })).filter((g) => g.filas.length > 0);

  const ultima = evaluaciones.at(-1);
  return {
    version: 1,
    muestras: muestras.map((m, i) => ({
      id: m.id,
      idMuestra: m.id_muestra,
      tipo: m.tipo,
      fecha: m.fecha_muestreo,
      nivel: m.nivel_analisis,
      notas: m.notas,
      aceite: evaluaciones[i]?.aceite ?? null,
      aditivos: evaluaciones[i]?.aditivos ?? null,
    })),
    grupos,
    // PENDIENTE(P6): falta confirmar cómo se decide la condición general.
    condicionGeneral: peorCondicion([
      ultima?.aceite?.condicion,
      ultima?.aditivos?.condicion,
    ]),
  };
}

/** Folio que se propone: el consecutivo de la última muestra ("260617-092" → "FOLAB-26-092"). */
export function folioSugerido(idUltimaMuestra: string | undefined): string {
  const m = /^(\d{2})\d{4}-(\d+)$/.exec(idUltimaMuestra ?? "");
  return m ? `FOLAB-${m[1]}-${m[2]}` : "";
}

/** "-92.8 %" a partir de la fracción; con signo, para ver si subió o bajó. */
export function formatDesviacion(d: number | null): string {
  if (d === null) return "";
  const pct = Number((d * 100).toFixed(1));
  return `${pct > 0 ? "+" : ""}${pct} %`;
}

/** Qué se puede hacer con un informe según su estado. */
export function accionesInforme(estado: string) {
  return {
    editar: estado === "borrador",
    validar: estado === "borrador",
    reabrir: estado === "validado",
  };
}
