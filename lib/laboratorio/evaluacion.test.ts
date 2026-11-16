import { describe, expect, it } from "vitest";
import {
  condicionPorFallas,
  evaluarMuestra,
  evaluarResultado,
  leerValor,
  type ContextoMuestra,
} from "./evaluacion";
import type { ParametroLab } from "./resultados";

const p = (
  id: string,
  tipo_regla: string,
  limite: number | string | null,
  cuenta_para: string | null = "aceite",
): ParametroLab => ({
  id,
  clave: id,
  nombre: id,
  unidad: null,
  grupo: cuenta_para === "aditivos" ? "aditivos" : "fisicoquimico",
  metodo: null,
  tipo_regla,
  limite_valor: typeof limite === "number" ? limite : null,
  limite_texto: typeof limite === "string" ? limite : null,
  activo: true,
  cuenta_para,
  en_basico: true,
  en_basico_mpc: true,
  en_extendido: true,
  en_premium: true,
});

// El catálogo, con los límites del informe FOLAB-26-092.
const CATALOGO = [
  p("codigo_iso", "codigo_iso", "18/16/13"),
  p("particulas_4um", "sin_limite", null),
  p("solidos_suspendidos", "maximo", 0.5),
  p("mpc", "maximo", 15),
  p("solidos_sedimentables", "sin_limite", null),
  p("viscosidad_40c", "nominal_pct", 10),
  p("agua_disuelta", "maximo", 500),
  p("tan", "linea_base_abs", 0.2),
  p("ph", "minimo", 5.5),
  p("oxidacion", "linea_base_abs", 0.2),
  p("al", "maximo", 15, null),
  p("fe", "maximo", 50, null),
  p("zn", "linea_base_pct", 15, "aditivos"),
  p("s", "linea_base_pct", 15, "aditivos"),
  p("ca", "linea_base_pct", 15, "aditivos"),
  p("p", "linea_base_pct", 15, "aditivos"),
];
const param = (id: string) => {
  const x = CATALOGO.find((c) => c.id === id);
  if (!x) throw new Error(id);
  return x;
};

// Resultados reales de las seis muestras del equipo 11B113 (FOLAB-26-092).
const CLAVES = [
  "codigo_iso",
  "solidos_suspendidos",
  "mpc",
  "solidos_sedimentables",
  "viscosidad_40c",
  "agua_disuelta",
  "tan",
  "ph",
  "oxidacion",
  "al",
  "fe",
  "zn",
  "s",
  "ca",
  "p",
] as const;
const muestra = (...valores: (string | null)[]) =>
  Object.fromEntries(
    CLAVES.map((c, i) => [c, valores[i]]).filter(([, v]) => v !== null),
  ) as Record<string, string>;
const ND = "No detectado";
const VIRGEN = muestra(
  "21/19/14",
  "2.158",
  "1.8",
  ND,
  "100.795",
  "<300",
  ND,
  ND,
  "1.372",
  "0",
  "13.7",
  "19.9",
  "6943",
  "0",
  "82.8",
);
const FOLAB = {
  "251209-380": muestra(
    "21/20/17",
    "8.011",
    "3.199",
    ND,
    "46.435",
    "316.6",
    "0.79709",
    "7",
    "1.239",
    "0",
    "13.6",
    "501",
    "684",
    "0",
    "193",
  ),
  "260216-044": muestra(
    "19/17/14",
    "1.28",
    "1.8",
    ND,
    "46.203",
    "159.59",
    "0.72774",
    "6.8",
    "1.237",
    null,
    null,
    null,
    null,
    null,
    null,
  ),
  "260430-078": muestra(
    "19/17/13",
    "1.052",
    "1.8",
    ND,
    "47.375",
    "369",
    null,
    null,
    "1.268",
    "80.6",
    "14.1",
    "500",
    "679",
    "0",
    "170",
  ),
  "260522-093": muestra(
    "18/17/13",
    "0.794",
    "1.8",
    ND,
    "46.382",
    null,
    null,
    null,
    "1.238",
    "184",
    "13.6",
    "487",
    "659",
    "0",
    "168",
  ),
  "260617-092": muestra(
    "18/16/13",
    "0.583",
    "4.3",
    ND,
    "46.763",
    null,
    null,
    null,
    "1.268",
    "169",
    "14.9",
    "489",
    "664",
    "0",
    "168",
  ),
};

const UMBRALES = { precaucionDesde: 2, criticoDesde: 5 };
// Mobil DTE 25 es ISO VG 46.
const ctxVirgen: ContextoMuestra = { esVirgen: true, nominal: 46, base: null };
const ctx: ContextoMuestra = {
  esVirgen: false,
  nominal: 46,
  base: { idMuestra: "251106-329", resultados: VIRGEN },
};
const veredicto = (id: string, texto: string, c = ctx) =>
  evaluarResultado(param(id), texto, c).veredicto;

describe("leerValor", () => {
  it("separa el número y su < o >", () => {
    expect(leerValor("0.583")).toEqual({ numero: 0.583, calificador: null });
    expect(leerValor("<300")).toEqual({ numero: 300, calificador: "<" });
    expect(leerValor("No detectado")).toEqual({
      numero: null,
      calificador: null,
    });
    expect(leerValor("18/16/13").numero).toBeNull();
    expect(leerValor(undefined).numero).toBeNull();
  });
});

describe("evaluarResultado", () => {
  it("máximo: pasa si es menor que el límite", () => {
    expect(veredicto("solidos_suspendidos", "0.499")).toBe("pasa");
    expect(veredicto("solidos_suspendidos", "0.5")).toBe("no_pasa");
    expect(veredicto("solidos_suspendidos", "0.583")).toBe("no_pasa");
  });

  it("mínimo: pasa si es mayor que el límite", () => {
    expect(veredicto("ph", "7")).toBe("pasa");
    expect(veredicto("ph", "5.5")).toBe("no_pasa");
  });

  it("un número acotado solo se evalúa si no deja duda", () => {
    expect(veredicto("agua_disuelta", "<300")).toBe("pasa");
    expect(veredicto("agua_disuelta", "<500")).toBe("pasa");
    expect(veredicto("agua_disuelta", "<600")).toBe("sin_evaluar");
    expect(veredicto("agua_disuelta", ">500")).toBe("no_pasa");
    expect(veredicto("agua_disuelta", ">100")).toBe("sin_evaluar");
    expect(veredicto("ph", ">6")).toBe("pasa");
    expect(veredicto("ph", "<5")).toBe("no_pasa");
    expect(veredicto("ph", "<9")).toBe("sin_evaluar");
  });

  it("un texto o un parámetro sin límite no se evalúan", () => {
    expect(veredicto("agua_disuelta", ND)).toBe("sin_evaluar");
    expect(veredicto("particulas_4um", "132090")).toBe("sin_evaluar");
    expect(veredicto("solidos_sedimentables", ND)).toBe("sin_evaluar");
  });

  it("código ISO: cada número debe ser menor o igual al del límite", () => {
    expect(veredicto("codigo_iso", "18/16/13")).toBe("pasa");
    expect(veredicto("codigo_iso", "17/15/12")).toBe("pasa");
    expect(veredicto("codigo_iso", "18/17/13")).toBe("no_pasa");
    expect(veredicto("codigo_iso", ND)).toBe("sin_evaluar");
  });

  it("viscosidad: nominal del aceite ± %, con el rango que se aplicó", () => {
    expect(evaluarResultado(param("viscosidad_40c"), "46.763", ctx)).toEqual({
      veredicto: "pasa",
      detalle: "41.4 a 50.6",
    });
    expect(veredicto("viscosidad_40c", "50.6")).toBe("pasa");
    expect(veredicto("viscosidad_40c", "100.795")).toBe("no_pasa");
    expect(
      evaluarResultado(param("viscosidad_40c"), "46", {
        ...ctx,
        nominal: null,
      }),
    ).toEqual({
      veredicto: "sin_evaluar",
      detalle: "El aceite del equipo no tiene viscosidad nominal.",
    });
  });

  it("línea base ± valor: contra la muestra virgen del equipo", () => {
    expect(evaluarResultado(param("oxidacion"), "1.268", ctx)).toEqual({
      veredicto: "pasa",
      detalle: "1.172 a 1.572 (virgen 251106-329)",
    });
    expect(veredicto("oxidacion", "1.572")).toBe("pasa");
    expect(veredicto("oxidacion", "1.6")).toBe("no_pasa");
  });

  it("línea base ± %", () => {
    // Zinc virgen 19.9 ± 15 % = 16.915 a 22.885
    expect(veredicto("zn", "22.885")).toBe("pasa");
    expect(veredicto("zn", "489")).toBe("no_pasa");
    // Calcio virgen 0: solo 0 queda dentro.
    expect(veredicto("ca", "0")).toBe("pasa");
    expect(veredicto("ca", "0.1")).toBe("no_pasa");
  });

  it("sin línea base no se evalúa, y dice por qué", () => {
    expect(
      evaluarResultado(param("oxidacion"), "1.372", ctxVirgen).detalle,
    ).toBe("Es la línea base.");
    expect(
      evaluarResultado(param("oxidacion"), "1.2", { ...ctx, base: null })
        .detalle,
    ).toBe("El equipo no tiene muestra virgen.");
    // El TAN de la virgen dice "No detectado".
    expect(evaluarResultado(param("tan"), "0.79709", ctx)).toEqual({
      veredicto: "sin_evaluar",
      detalle: "La muestra virgen 251106-329 no tiene este valor.",
    });
  });
});

describe("condicionPorFallas", () => {
  it("usa los umbrales configurados", () => {
    expect(
      [0, 1, 2, 3, 4, 5, 9].map((n) => condicionPorFallas(n, UMBRALES)),
    ).toEqual([
      "normal",
      "normal",
      "precaucion",
      "precaucion",
      "precaucion",
      "critico",
      "critico",
    ]);
    expect(condicionPorFallas(4, { precaucionDesde: 2, criticoDesde: 4 })).toBe(
      "critico",
    );
  });
});

describe("evaluarMuestra reproduce el informe FOLAB-26-092", () => {
  const condiciones = (r: Record<string, string>, c: ContextoMuestra) => {
    const e = evaluarMuestra(CATALOGO, r, c, UMBRALES);
    return [e.aceite?.condicion ?? null, e.aditivos?.condicion ?? null];
  };

  it("muestra virgen: Precaución, sin condición de aditivos", () => {
    const e = evaluarMuestra(CATALOGO, VIRGEN, ctxVirgen, UMBRALES);
    expect(e.aceite).toEqual({
      condicion: "precaucion",
      noPasa: 3,
      capturados: 9,
    });
    expect(e.aditivos).toBeNull();
  });

  it("condición del aceite y de aditivos de cada muestra", () => {
    expect(condiciones(FOLAB["251209-380"], ctx)).toEqual([
      "precaucion",
      "precaucion",
    ]);
    // Sin resultados de aditivos no hay condición de aditivos.
    expect(condiciones(FOLAB["260216-044"], ctx)).toEqual(["precaucion", null]);
    expect(condiciones(FOLAB["260430-078"], ctx)).toEqual([
      "precaucion",
      "precaucion",
    ]);
    expect(condiciones(FOLAB["260522-093"], ctx)).toEqual([
      "precaucion",
      "precaucion",
    ]);
    expect(condiciones(FOLAB["260617-092"], ctx)).toEqual([
      "normal",
      "precaucion",
    ]);
  });

  it("el desgaste se evalúa pero no cuenta para la condición", () => {
    const e = evaluarMuestra(CATALOGO, FOLAB["260617-092"], ctx, UMBRALES);
    expect(e.porParametro.al?.veredicto).toBe("no_pasa");
    expect(e.aceite).toEqual({ condicion: "normal", noPasa: 1, capturados: 6 });
  });

  it("la condición de aditivos nunca es Crítico", () => {
    const e = evaluarMuestra(CATALOGO, FOLAB["251209-380"], ctx, {
      precaucionDesde: 1,
      criticoDesde: 2,
    });
    expect(e.aditivos?.noPasa).toBe(3);
    expect(e.aditivos?.condicion).toBe("precaucion");
    expect(e.aceite?.condicion).toBe("critico");
  });

  it("sin resultados no hay condición", () => {
    const e = evaluarMuestra(CATALOGO, {}, ctx, UMBRALES);
    expect(e.aceite).toBeNull();
    expect(e.aditivos).toBeNull();
  });
});
