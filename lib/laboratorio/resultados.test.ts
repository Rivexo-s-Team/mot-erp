import { describe, expect, it } from "vitest";
import {
  gruposDeCaptura,
  interpretarValor,
  loPideElNivel,
  prepararResultados,
  type ParametroLab,
} from "./resultados";

const p = (extra: Partial<ParametroLab>): ParametroLab => ({
  id: "p1",
  clave: "agua_disuelta",
  nombre: "Agua disuelta",
  unidad: "ppm",
  grupo: "fisicoquimico",
  metodo: null,
  tipo_regla: "maximo",
  limite_valor: 500,
  limite_texto: null,
  activo: true,
  en_basico: true,
  en_basico_mpc: true,
  en_extendido: true,
  en_premium: true,
  ...extra,
});
const numerico = p({});
const iso = p({
  id: "iso",
  tipo_regla: "codigo_iso",
  limite_texto: "18/16/13",
});
const cualitativo = p({
  id: "ftir",
  grupo: "cualitativo",
  tipo_regla: "sin_limite",
});
const texto = (entrada: string, param = numerico) => {
  const r = interpretarValor(entrada, param);
  return r.ok ? r.texto : null;
};

describe("interpretarValor", () => {
  it("acepta números con punto decimal", () => {
    expect(texto("0.583")).toBe("0.583");
    expect(texto(" 132090 ")).toBe("132090");
    expect(texto("0")).toBe("0");
  });

  it("acepta un número acotado y le quita el espacio", () => {
    expect(texto("<300")).toBe("<300");
    expect(texto("< 300")).toBe("<300");
    expect(texto(">15.5")).toBe(">15.5");
  });

  it("acepta textos sin números, como en el informe", () => {
    expect(texto("No detectado")).toBe("No detectado");
    expect(texto("No  detectado ")).toBe("No detectado");
    expect(texto("N/D")).toBe("N/D");
  });

  it("vacío significa que no se midió", () => {
    expect(texto("   ")).toBe("");
  });

  it("rechaza números mal escritos en lugar de guardarlos como texto", () => {
    for (const mal of [
      "1,335,937",
      "12,5",
      "1.2.3",
      "5 ppm",
      "<",
      "< abc",
      "-3",
      "1e5",
    ])
      expect(interpretarValor(mal, numerico).ok, mal).toBe(false);
  });

  it("el código ISO va como 18/16/13", () => {
    expect(texto("18/16/13", iso)).toBe("18/16/13");
    expect(texto("18 / 16 / 13", iso)).toBe("18/16/13");
    expect(texto("No detectado", iso)).toBe("No detectado");
    expect(interpretarValor("18", iso).ok).toBe(false);
    expect(interpretarValor("18-16-13", iso).ok).toBe(false);
    // En un parámetro numérico, un código ISO es un error de captura.
    expect(interpretarValor("18/16/13", numerico).ok).toBe(false);
  });

  it("los cualitativos son texto libre", () => {
    expect(
      texto("Sin cambios respecto a la muestra 251106-329", cualitativo),
    ).toBe("Sin cambios respecto a la muestra 251106-329");
    expect(interpretarValor("x".repeat(101), cualitativo).ok).toBe(false);
  });
});

describe("loPideElNivel", () => {
  const soloPremium = p({
    en_basico: false,
    en_basico_mpc: false,
    en_extendido: false,
  });
  it("sigue las casillas del catálogo", () => {
    expect(loPideElNivel(soloPremium, "premium")).toBe(true);
    expect(loPideElNivel(soloPremium, "basico_mpc")).toBe(false);
  });
  it("sin nivel definido se piden todos", () => {
    expect(loPideElNivel(soloPremium, null)).toBe(true);
  });
});

describe("gruposDeCaptura", () => {
  const lista = [
    cualitativo,
    numerico,
    p({ id: "fe", grupo: "desgaste" }),
    p({ id: "viejo", activo: false }),
    p({ id: "viejo2", activo: false }),
  ];
  it("agrupa en el orden del informe y omite grupos vacíos", () => {
    const g = gruposDeCaptura(lista, new Set());
    expect(g.map((x) => x.grupo)).toEqual([
      "fisicoquimico",
      "desgaste",
      "cualitativo",
    ]);
    expect(g[0]?.titulo).toBe("Fisicoquímicos");
  });
  it("un parámetro desactivado solo aparece si ya tiene resultado", () => {
    const ids = gruposDeCaptura(lista, new Set(["viejo"])).flatMap((x) =>
      x.parametros.map((q) => q.id),
    );
    expect(ids).toContain("viejo");
    expect(ids).not.toContain("viejo2");
  });
});

describe("prepararResultados", () => {
  const lista = [numerico, iso, cualitativo];
  it("normaliza y deja fuera los vacíos", () => {
    expect(
      prepararResultados({ p1: "< 300", iso: "", ftir: " Normal " }, lista),
    ).toEqual({ ok: true, resultados: { p1: "<300", ftir: "Normal" } });
  });
  it("devuelve el error de cada parámetro mal escrito", () => {
    const r = prepararResultados({ p1: "12,5", iso: "18", ftir: "ok" }, lista);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(["iso", "p1"]);
  });
  it("no acepta parámetros que no están en el catálogo", () => {
    expect(prepararResultados({ otro: "5" }, lista).ok).toBe(false);
    expect(prepararResultados({ otro: "" }, lista).ok).toBe(true);
  });
});
