import { describe, expect, it } from "vitest";
import {
  escala,
  finDeMes,
  importeCorto,
  inicioDeMes,
  nombreMes,
  nombreMesLargo,
  seriesPorMoneda,
  ultimosMeses,
} from "./tablero";

describe("meses", () => {
  it("lista los últimos meses hasta el actual, cruzando el año", () => {
    expect(ultimosMeses("2026-02-15", 4)).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
  });
  it("da el inicio y el fin de un mes, con año bisiesto", () => {
    expect(inicioDeMes("2026-11-27")).toBe("2026-11-01");
    expect(finDeMes("2026-11-01")).toBe("2026-11-30");
    expect(finDeMes("2028-02-01")).toBe("2028-02-29");
    expect(finDeMes("2026-12-01")).toBe("2026-12-31");
  });
  it("nombra los meses", () => {
    expect(nombreMes("2026-11-01")).toBe("nov 26");
    expect(nombreMesLargo("2026-11-01")).toBe("noviembre de 2026");
  });
});

describe("seriesPorMoneda", () => {
  const fila = (mes: string, moneda: string, facturado: number) => ({
    mes,
    moneda,
    facturas: 1,
    facturado,
    facturado_total: facturado,
    cobrado: 0,
  });
  it("separa por moneda y rellena con ceros los meses sin movimiento", () => {
    const series = seriesPorMoneda(
      [fila("2026-11-01", "USD", 100), fila("2026-10-01", "MXN", 50)],
      ["2026-10-01", "2026-11-01"],
    );
    expect(series.map((s) => s.moneda)).toEqual(["MXN", "USD"]);
    expect(series[1]!.meses.map((m) => m.facturado)).toEqual([0, 100]);
    expect(series[0]!.meses.map((m) => m.facturado)).toEqual([50, 0]);
  });
  it("sin datos no hay series", () => {
    expect(seriesPorMoneda([], ["2026-11-01"])).toEqual([]);
  });
});

describe("escala", () => {
  it("usa pasos redondos y cubre el máximo", () => {
    expect(escala(1044)).toEqual({
      tope: 1500,
      marcas: [0, 500, 1000, 1500],
    });
    expect(escala(348)).toEqual({ tope: 400, marcas: [0, 100, 200, 300, 400] });
    expect(escala(80000).tope).toBe(80000);
  });
  it("sin valores deja un eje mínimo", () => {
    expect(escala(0)).toEqual({ tope: 1, marcas: [0, 1] });
  });
  it("abrevia los importes del eje", () => {
    expect(importeCorto(500)).toBe("500");
    expect(importeCorto(1500)).toBe("1.5 k");
    expect(importeCorto(2000000)).toBe("2 M");
  });
});
