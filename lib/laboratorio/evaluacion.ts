import type { ParametroLab } from "./resultados";

/**
 * Evaluación de resultados (DISENO §4.5): pasa o no pasa según la regla de
 * cada parámetro, y condición del aceite según cuántos no pasan. Sin base ni
 * navegador: todo lo que necesita llega como datos.
 */

export type Veredicto = "pasa" | "no_pasa" | "sin_evaluar";

export type Evaluacion = {
  veredicto: Veredicto;
  /** Límite que se aplicó a esta muestra, o por qué no se pudo evaluar. */
  detalle: string | null;
};

export type Condicion = "normal" | "precaucion" | "critico";

export const CONDICIONES: Record<Condicion, string> = {
  normal: "Normal",
  precaucion: "Precaución",
  critico: "Crítico",
};

export type Umbrales = { precaucionDesde: number; criticoDesde: number };

export type ContextoMuestra = {
  esVirgen: boolean;
  /** Viscosidad nominal a 40 °C del aceite del equipo. */
  nominal: number | null;
  /** Muestra virgen del equipo con la que se compara. */
  base: { idMuestra: string; resultados: Record<string, string> } | null;
};

/** El número de un resultado y su < o >, igual que lo calcula la base. */
export function leerValor(texto: string | undefined): {
  numero: number | null;
  calificador: "<" | ">" | null;
} {
  const m = /^([<>]?)(\d+(?:\.\d+)?)$/.exec(texto ?? "");
  if (!m) return { numero: null, calificador: null };
  return {
    numero: Number(m[2]),
    calificador: m[1] === "<" || m[1] === ">" ? m[1] : null,
  };
}

/** Sin los decimales de sobra que deja la aritmética (41.400000000000006 → 41.4). */
const limpio = (n: number) => Number(n.toFixed(6));
const rango = (centro: number, tolerancia: number) =>
  `${limpio(centro - tolerancia)} a ${limpio(centro + tolerancia)}`;

const SIN: Evaluacion = { veredicto: "sin_evaluar", detalle: null };
const sin = (detalle: string): Evaluacion => ({
  veredicto: "sin_evaluar",
  detalle,
});
const segun = (pasa: boolean, detalle: string | null = null): Evaluacion => ({
  veredicto: pasa ? "pasa" : "no_pasa",
  detalle,
});

function evaluarIso(texto: string, limite: string | null): Evaluacion {
  const partes = (t: string) => t.split("/").map(Number);
  if (!limite || !/^\d+\/\d+\/\d+$/.test(texto)) return SIN;
  const lim = partes(limite);
  return segun(partes(texto).every((v, i) => v <= (lim[i] ?? 0)));
}

/** Evalúa un resultado contra la regla de su parámetro. */
export function evaluarResultado(
  p: ParametroLab,
  texto: string | undefined,
  ctx: ContextoMuestra,
): Evaluacion {
  if (!texto || p.tipo_regla === "sin_limite") return SIN;
  if (p.tipo_regla === "codigo_iso") return evaluarIso(texto, p.limite_texto);

  const { numero, calificador } = leerValor(texto);
  const limite = p.limite_valor;
  // Un texto ("No detectado") no se evalúa: ni pasa ni cuenta como falla.
  if (numero === null || limite === null) return SIN;

  if (p.tipo_regla === "maximo" || p.tipo_regla === "minimo") {
    // Para un mínimo es lo mismo visto al revés.
    const esMax = p.tipo_regla === "maximo";
    const dentro = esMax ? numero < limite : numero > limite;
    if (calificador === null) return segun(dentro);
    // "<300" contra un máximo de 500 pasa seguro; "<600" no se sabe.
    const acotaHaciaElLadoBueno = (calificador === "<") === esMax;
    if (acotaHaciaElLadoBueno)
      return numero === limite || dentro ? segun(true) : SIN;
    return numero === limite || !dentro ? segun(false) : SIN;
  }

  // Las demás reglas comparan contra un valor central: con < o > no se puede.
  if (calificador !== null) return SIN;

  if (p.tipo_regla === "nominal_pct") {
    if (ctx.nominal === null)
      return sin("El aceite del equipo no tiene viscosidad nominal.");
    const tolerancia = (ctx.nominal * limite) / 100;
    return segun(
      limpio(Math.abs(numero - ctx.nominal)) <= limpio(tolerancia),
      rango(ctx.nominal, tolerancia),
    );
  }

  if (p.tipo_regla === "linea_base_abs" || p.tipo_regla === "linea_base_pct") {
    if (ctx.esVirgen) return sin("Es la línea base.");
    if (!ctx.base) return sin("El equipo no tiene muestra virgen.");
    const base = leerValor(ctx.base.resultados[p.id]);
    if (base.numero === null || base.calificador !== null)
      return sin(
        `La muestra virgen ${ctx.base.idMuestra} no tiene este valor.`,
      );
    const tolerancia =
      p.tipo_regla === "linea_base_abs" ? limite : (base.numero * limite) / 100;
    return segun(
      limpio(Math.abs(numero - base.numero)) <= limpio(tolerancia),
      `${rango(base.numero, tolerancia)} (virgen ${ctx.base.idMuestra})`,
    );
  }
  return SIN;
}

/** Condición según cuántas pruebas no pasan. Menos del primer umbral es Normal. */
export function condicionPorFallas(noPasa: number, u: Umbrales): Condicion {
  if (noPasa >= u.criticoDesde) return "critico";
  if (noPasa >= u.precaucionDesde) return "precaucion";
  return "normal";
}

export type ResumenCondicion = {
  condicion: Condicion;
  noPasa: number;
  /** Resultados capturados que cuentan para esta condición. */
  capturados: number;
};

export type EvaluacionMuestra = {
  porParametro: Record<string, Evaluacion>;
  /** Vacío si no hay resultados que cuenten para la condición. */
  aceite: ResumenCondicion | null;
  aditivos: ResumenCondicion | null;
};

/** Evalúa todos los resultados de una muestra y saca sus dos condiciones. */
export function evaluarMuestra(
  parametros: ParametroLab[],
  resultados: Record<string, string>,
  ctx: ContextoMuestra,
  umbrales: Umbrales,
): EvaluacionMuestra {
  const porParametro: Record<string, Evaluacion> = {};
  const cuenta = {
    aceite: { noPasa: 0, capturados: 0 },
    aditivos: { noPasa: 0, capturados: 0 },
  };
  for (const p of parametros) {
    const texto = resultados[p.id];
    if (!texto) continue;
    const e = evaluarResultado(p, texto, ctx);
    porParametro[p.id] = e;
    if (p.cuenta_para === "aceite" || p.cuenta_para === "aditivos") {
      cuenta[p.cuenta_para].capturados += 1;
      if (e.veredicto === "no_pasa") cuenta[p.cuenta_para].noPasa += 1;
    }
  }
  const resumen = (
    c: { noPasa: number; capturados: number },
    maxima: Condicion,
  ): ResumenCondicion | null => {
    if (c.capturados === 0) return null;
    const condicion = condicionPorFallas(c.noPasa, umbrales);
    return {
      ...c,
      condicion:
        condicion === "critico" && maxima === "precaucion"
          ? "precaucion"
          : condicion,
    };
  };
  return {
    porParametro,
    aceite: resumen(cuenta.aceite, "critico"),
    // La condición de aditivos solo es Normal o Precaución, y la muestra
    // virgen no la lleva: es contra lo que se comparan.
    // PENDIENTE(P6): usa el mismo umbral de Precaución que la del aceite.
    aditivos: ctx.esVirgen ? null : resumen(cuenta.aditivos, "precaucion"),
  };
}
