import { describe, expect, it } from "vitest";
import {
  cuentasDeMoneda,
  escala,
  finDeMes,
  importeCorto,
  inicioDeMes,
  nombreMes,
  nombreMesLargo,
  saldosPorCuenta,
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

describe("por cliente y planta", () => {
  const fila = (
    cuenta: string,
    planta: string | null,
    facturado: number,
    renta = 0,
    robox = 0,
    moneda = "USD",
  ) => ({
    cuenta_id: cuenta,
    cuenta: `Cuenta ${cuenta}`,
    planta_id: planta,
    planta,
    moneda,
    facturado,
    renta_mensual: renta,
    robox,
  });

  it("agrupa por cuenta, suma sin errores de decimales y ordena por lo facturado", () => {
    const cuentas = cuentasDeMoneda(
      [
        fila("a", "Norte", 0.1, 300, 1),
        fila("a", "Sur", 0.2, 0, 2),
        fila("b", "Centro", 1000, 0, 0),
        fila("a", "Norte", 500, 0, 0, "MXN"),
      ],
      [
        {
          cuenta_id: "a",
          cuenta: "Cuenta a",
          moneda: "USD",
          saldo: 116,
          vencido: 16,
        },
        {
          cuenta_id: "a",
          cuenta: "Cuenta a",
          moneda: "MXN",
          saldo: 999,
          vencido: 0,
        },
        {
          cuenta_id: "z",
          cuenta: "Solo debe",
          moneda: "USD",
          saldo: 58,
          vencido: 58,
        },
      ],
      "USD",
    );
    expect(cuentas.map((c) => c.cuenta_id)).toEqual(["b", "a", "z"]);
    // La que solo debe sale al final, sin plantas.
    expect(cuentas[2]).toMatchObject({
      cuenta: "Solo debe",
      facturado: 0,
      saldo: 58,
      plantas: [],
    });
    expect(cuentas[1]).toMatchObject({
      facturado: 0.3,
      renta_mensual: 300,
      robox: 3,
      saldo: 116,
      vencido: 16,
    });
    expect(cuentas[1]!.plantas.map((p) => p.planta)).toEqual(["Sur", "Norte"]);
    expect(cuentas[0]).toMatchObject({ saldo: 0, vencido: 0 });
  });

  it("lo facturado sin planta se nombra", () => {
    expect(
      cuentasDeMoneda([fila("a", null, 40)], [], "USD")[0]!.plantas[0]!.planta,
    ).toBe("Sin planta");
  });

  it("suma el saldo y lo vencido por cuenta y moneda", () => {
    expect(
      saldosPorCuenta([
        {
          cuenta_id: "a",
          cuenta: "A",
          moneda: "USD",
          saldo: 0.1,
          vencida: true,
        },
        {
          cuenta_id: "a",
          cuenta: "A",
          moneda: "USD",
          saldo: 0.2,
          vencida: false,
        },
        {
          cuenta_id: "a",
          cuenta: "A",
          moneda: "MXN",
          saldo: 50,
          vencida: false,
        },
        { cuenta_id: "b", cuenta: "B", moneda: "USD", saldo: 0, vencida: true },
      ]),
    ).toEqual([
      { cuenta_id: "a", cuenta: "A", moneda: "USD", saldo: 0.3, vencido: 0.1 },
      { cuenta_id: "a", cuenta: "A", moneda: "MXN", saldo: 50, vencido: 0 },
    ]);
  });
});
