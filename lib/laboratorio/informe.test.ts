import { describe, expect, it } from "vitest";
import {
  accionesInforme,
  armarInforme,
  elegirVirgen,
  folioSugerido,
  formatDesviacion,
  peorCondicion,
  type MuestraDeInforme,
  type ParametroInforme,
} from "./informe";

const p = (
  id: string,
  grupo: string,
  tipo_regla: string,
  limite: number | string | null,
  base_comparacion: string | null,
  cuenta_para: string | null,
): ParametroInforme => ({
  id,
  clave: id,
  nombre: id.toUpperCase(),
  unidad: "ppm",
  grupo,
  metodo: null,
  tipo_regla,
  limite_valor: typeof limite === "number" ? limite : null,
  limite_texto: typeof limite === "string" ? limite : null,
  activo: true,
  cuenta_para,
  base_comparacion,
  en_basico: true,
  en_basico_mpc: true,
  en_extendido: true,
  en_premium: true,
});

const CATALOGO = [
  p(
    "codigo_iso",
    "fisicoquimico",
    "codigo_iso",
    "18/16/13",
    "usado_vs_tratado",
    "aceite",
  ),
  p(
    "particulas_4um",
    "fisicoquimico",
    "sin_limite",
    null,
    "usado_vs_tratado",
    "aceite",
  ),
  p(
    "solidos_suspendidos",
    "fisicoquimico",
    "maximo",
    0.5,
    "usado_vs_tratado",
    "aceite",
  ),
  p(
    "viscosidad_40c",
    "fisicoquimico",
    "nominal_pct",
    10,
    "usado_vs_tratado",
    "aceite",
  ),
  p("agua_disuelta", "fisicoquimico", "maximo", 500, "valor_teorico", "aceite"),
  p(
    "oxidacion",
    "fisicoquimico",
    "linea_base_abs",
    0.2,
    "virgen_vs_tratado",
    "aceite",
  ),
  p("al", "desgaste", "maximo", 15, "usado_vs_tratado", null),
  p("zn", "aditivos", "linea_base_pct", 15, "virgen_vs_tratado", "aditivos"),
  p("k", "contaminantes", "sin_limite", null, "usado_vs_tratado", null),
];

const m = (
  id_muestra: string,
  tipo: string,
  fecha_muestreo: string,
  resultados: Record<string, string>,
): MuestraDeInforme => ({
  id: `id-${id_muestra}`,
  id_muestra,
  tipo,
  fecha_muestreo,
  nivel_analisis: "premium",
  notas: null,
  resultados,
});

// Valores reales del equipo 11B113 (FOLAB-26-092), tres de sus seis muestras.
const VIRGEN = m("251106-329", "virgen", "2025-11-06", {
  codigo_iso: "21/19/14",
  particulas_4um: "1335937",
  solidos_suspendidos: "2.158",
  viscosidad_40c: "100.795",
  agua_disuelta: "<300",
  oxidacion: "1.372",
  al: "0",
  zn: "19.9",
});
const USADO = m("251209-380", "usado", "2025-12-16", {
  codigo_iso: "21/20/17",
  particulas_4um: "1831620",
  solidos_suspendidos: "8.011",
  viscosidad_40c: "46.435",
  agua_disuelta: "316.6",
  oxidacion: "1.239",
  al: "0",
  zn: "501",
});
const ULTIMA = m("260617-092", "filtrado", "2026-06-17", {
  codigo_iso: "18/16/13",
  particulas_4um: "132090",
  solidos_suspendidos: "0.583",
  viscosidad_40c: "46.763",
  oxidacion: "1.268",
  al: "169",
  zn: "489",
});
const UMBRALES = { precaucionDesde: 2, criticoDesde: 5 };
const armar = (muestras: MuestraDeInforme[], virgenes = [VIRGEN]) =>
  armarInforme({
    parametros: CATALOGO,
    muestras,
    virgenes,
    nominal: 46,
    umbrales: UMBRALES,
  });

describe("armarInforme", () => {
  // A propósito en desorden: el informe las ordena por fecha.
  const informe = armar([ULTIMA, VIRGEN, USADO]);
  const fila = (id: string) => {
    const f = informe.grupos
      .flatMap((g) => g.filas)
      .find((x) => x.parametroId === id);
    if (!f) throw new Error(id);
    return f;
  };

  it("pone una columna por muestra, de la más antigua a la más reciente", () => {
    expect(informe.muestras.map((x) => x.idMuestra)).toEqual([
      "251106-329",
      "251209-380",
      "260617-092",
    ]);
    expect(informe.muestras[2]).toMatchObject({
      tipo: "filtrado",
      fecha: "2026-06-17",
      nivel: "premium",
    });
  });

  it("cada muestra lleva su condición del aceite y de aditivos", () => {
    expect(informe.muestras.map((x) => x.aceite?.condicion)).toEqual([
      "precaucion",
      "precaucion",
      "normal",
    ]);
    // La virgen no lleva condición de aditivos; con un solo aditivo fuera, Normal.
    expect(informe.muestras.map((x) => x.aditivos?.condicion ?? null)).toEqual([
      null,
      "normal",
      "normal",
    ]);
  });

  it("agrupa los parámetros como el informe y omite los que nadie midió", () => {
    expect(informe.grupos.map((g) => g.titulo)).toEqual([
      "Fisicoquímicos",
      "Elementos de desgaste",
      "Aditivos",
    ]);
    expect(informe.grupos[0]?.filas.map((f) => f.clave)).toEqual([
      "codigo_iso",
      "particulas_4um",
      "solidos_suspendidos",
      "viscosidad_40c",
      "agua_disuelta",
      "oxidacion",
    ]);
  });

  it("cada valor lleva su veredicto; lo que no se midió queda vacío", () => {
    expect(fila("solidos_suspendidos").valores).toEqual([
      { texto: "2.158", veredicto: "no_pasa" },
      { texto: "8.011", veredicto: "no_pasa" },
      { texto: "0.583", veredicto: "no_pasa" },
    ]);
    expect(fila("agua_disuelta").valores).toEqual([
      { texto: "<300", veredicto: "pasa" },
      { texto: "316.6", veredicto: "pasa" },
      null,
    ]);
    expect(fila("oxidacion").valores.map((v) => v?.veredicto)).toEqual([
      "sin_evaluar",
      "pasa",
      "pasa",
    ]);
    expect(fila("al").valores[2]).toEqual({
      texto: "169",
      veredicto: "no_pasa",
    });
  });

  it("escribe el límite como en el informe, la viscosidad con el nominal del aceite", () => {
    expect(fila("codigo_iso").limite).toBe("18/16/13");
    expect(fila("solidos_suspendidos").limite).toBe("< 0.5");
    expect(fila("viscosidad_40c").limite).toBe("46 ± 10 %");
    expect(fila("oxidacion").limite).toBe("Virgen ± 0.2");
    expect(fila("particulas_4um").limite).toBeNull();
  });

  it("da los límites como números para dibujarlos en las gráficas", () => {
    expect(fila("solidos_suspendidos").limites).toEqual([0.5]);
    expect(fila("viscosidad_40c").limites).toEqual([41.4, 50.6]);
    // Oxidación: virgen 1.372 ± 0.2
    expect(fila("oxidacion").limites).toEqual([1.172, 1.572]);
    expect(fila("particulas_4um").limites).toEqual([]);
    expect(fila("codigo_iso").limites).toEqual([]);
  });

  it("desviación de la última muestra contra el aceite usado, como el informe", () => {
    expect(fila("particulas_4um").desviacion).toBeCloseTo(-0.927884, 6);
    expect(fila("solidos_suspendidos").desviacion).toBeCloseTo(-0.927225, 6);
    expect(fila("viscosidad_40c").desviacion).toBeCloseTo(0.007064, 6);
  });

  it("o contra la virgen, según el parámetro", () => {
    // Oxidación: (1.268 − 1.372) / 1.372
    expect(fila("oxidacion").desviacion).toBeCloseTo(-0.075802, 6);
    expect(fila("zn").desviacion).toBeCloseTo(23.572864, 6);
  });

  it("sin desviación si no hay con qué comparar", () => {
    // Código ISO no es un número; agua no tiene referencia; aluminio usado = 0.
    expect(fila("codigo_iso").desviacion).toBeNull();
    expect(fila("agua_disuelta").desviacion).toBeNull();
    expect(fila("al").desviacion).toBeNull();
    // Sin muestra de aceite usado en el informe.
    const sinUsado = armar([VIRGEN, ULTIMA]);
    expect(
      sinUsado.grupos[0]?.filas.find((f) => f.clave === "particulas_4um")
        ?.desviacion,
    ).toBeNull();
  });

  it("la condición general es la peor de la última muestra", () => {
    expect(informe.condicionGeneral).toBe("normal");
    expect(armar([VIRGEN, USADO]).condicionGeneral).toBe("precaucion");
    expect(armar([]).condicionGeneral).toBeNull();
  });

  it("evalúa contra la virgen del equipo aunque no esté en el informe", () => {
    const soloUltima = armar([ULTIMA]);
    const oxidacion = soloUltima.grupos[0]?.filas.find(
      (f) => f.clave === "oxidacion",
    );
    expect(oxidacion?.valores[0]?.veredicto).toBe("pasa");
    const sinVirgen = armar([ULTIMA], []);
    expect(
      sinVirgen.grupos[0]?.filas.find((f) => f.clave === "oxidacion")
        ?.valores[0]?.veredicto,
    ).toBe("sin_evaluar");
  });
});

describe("elegirVirgen", () => {
  const v1 = m("250101-001", "virgen", "2025-01-01", {});
  const v2 = m("260101-001", "virgen", "2026-01-01", {});
  it("toma la más reciente que no sea posterior a la muestra", () => {
    expect(elegirVirgen([v2, v1], "2025-06-01")?.id_muestra).toBe("250101-001");
    expect(elegirVirgen([v1, v2], "2026-06-01")?.id_muestra).toBe("260101-001");
    expect(elegirVirgen([v1, v2], "2024-06-01")).toBeNull();
  });
});

describe("utilidades del informe", () => {
  it("peorCondicion", () => {
    expect(peorCondicion(["normal", "precaucion", null])).toBe("precaucion");
    expect(peorCondicion(["critico", "precaucion"])).toBe("critico");
    expect(peorCondicion([null, undefined])).toBeNull();
  });
  it("propone el folio con el consecutivo de la última muestra", () => {
    expect(folioSugerido("260617-092")).toBe("FOLAB-26-092");
    expect(folioSugerido(undefined)).toBe("");
  });
  it("escribe la desviación en porcentaje con signo", () => {
    expect(formatDesviacion(-0.927884)).toBe("-92.8 %");
    expect(formatDesviacion(0.007064)).toBe("+0.7 %");
    expect(formatDesviacion(0)).toBe("0 %");
    expect(formatDesviacion(null)).toBe("");
  });
  it("un informe validado solo se puede reabrir", () => {
    expect(accionesInforme("borrador")).toEqual({
      editar: true,
      validar: true,
      reabrir: false,
    });
    expect(accionesInforme("validado")).toEqual({
      editar: false,
      validar: false,
      reabrir: true,
    });
  });
});
