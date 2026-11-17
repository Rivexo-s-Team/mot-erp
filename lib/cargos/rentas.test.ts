import { describe, expect, it } from "vitest";
import {
  desplazarMes,
  mesDeDia,
  nombreMes,
  periodoDeMes,
  rentasPorContrato,
  resumenRentas,
  type RentaDelMes,
} from "./rentas";

const r = (extra: Partial<RentaDelMes>): RentaDelMes => ({
  tarifa_id: "t",
  contrato_id: "c1",
  cuenta: "GOPLAS",
  planta: "Lechería",
  concepto: "Renta Robox",
  precio: 289,
  moneda: "USD",
  parcial: false,
  cargo_id: null,
  cargo_estado: null,
  ...extra,
});

describe("mes de las rentas", () => {
  it("convierte el mes elegido en su primer día", () => {
    expect(periodoDeMes("2026-11")).toBe("2026-11-01");
    expect(periodoDeMes("2026-13")).toBeNull();
    expect(periodoDeMes("2026-00")).toBeNull();
    expect(periodoDeMes("noviembre")).toBeNull();
    expect(periodoDeMes(undefined)).toBeNull();
    expect(periodoDeMes(["2026-11"])).toBeNull();
  });

  it("nombra el mes en español", () => {
    expect(nombreMes("2026-11")).toBe("noviembre de 2026");
    expect(nombreMes("2027-01-01")).toBe("enero de 2027");
    expect(mesDeDia("2026-11-17")).toBe("2026-11");
  });

  it("pasa al mes anterior y al siguiente cruzando el año", () => {
    expect(desplazarMes("2026-01", -1)).toBe("2025-12");
    expect(desplazarMes("2026-12", 1)).toBe("2027-01");
    expect(desplazarMes("2026-11", 0)).toBe("2026-11");
  });
});

describe("resumenRentas", () => {
  it("cuenta lo que falta y lo suma por moneda sin errores de decimales", () => {
    const resumen = resumenRentas([
      r({ precio: 289.1 }),
      r({ precio: 289.2 }),
      r({ precio: 5000, moneda: "MXN", parcial: true }),
      r({ precio: 300, cargo_id: "k1", cargo_estado: "pendiente" }),
    ]);
    expect(resumen).toEqual({
      porGenerar: 3,
      generadas: 1,
      parciales: 1,
      totales: [
        { moneda: "MXN", centavos: BigInt(500000) },
        { moneda: "USD", centavos: BigInt(57830) },
      ],
    });
  });

  it("un mes ya generado no tiene nada pendiente", () => {
    expect(resumenRentas([r({ cargo_id: "k" })])).toMatchObject({
      porGenerar: 0,
      generadas: 1,
      totales: [],
    });
    expect(resumenRentas([]).porGenerar).toBe(0);
  });
});

describe("rentasPorContrato", () => {
  it("agrupa las rentas seguidas del mismo contrato", () => {
    const grupos = rentasPorContrato([
      r({ concepto: "A" }),
      r({ concepto: "B" }),
      r({
        concepto: "C",
        contrato_id: "c2",
        cuenta: "NACOBRE",
        planta: "Celaya",
      }),
    ]);
    expect(grupos.map((g) => [g.titulo, g.rentas.length])).toEqual([
      ["GOPLAS · Lechería", 2],
      ["NACOBRE · Celaya", 1],
    ]);
  });
});
