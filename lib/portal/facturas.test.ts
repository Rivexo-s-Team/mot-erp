import { describe, expect, it } from "vitest";
import { estadoDePago, saldosPorMoneda } from "./facturas";

const f = (
  saldo: number,
  pagado = 0,
  fecha = "2026-11-01",
  moneda = "USD",
) => ({ fecha, dias_credito: 30, moneda, pagado, saldo });

describe("estadoDePago", () => {
  it("pagada cuando ya no debe nada, aunque haya vencido", () => {
    expect(estadoDePago(f(0, 116, "2026-01-01"), "2026-11-25")).toBe("pagada");
  });
  it("por pagar y pago parcial mientras no vence", () => {
    expect(estadoDePago(f(116), "2026-11-25")).toBe("por_pagar");
    expect(estadoDePago(f(66, 50), "2026-11-25")).toBe("parcial");
  });
  it("vence al día siguiente de su fecha más los días de crédito", () => {
    expect(estadoDePago(f(116), "2026-12-01")).toBe("por_pagar");
    expect(estadoDePago(f(116), "2026-12-02")).toBe("vencida");
    expect(estadoDePago(f(66, 50), "2026-12-02")).toBe("vencida");
  });
});

describe("saldosPorMoneda", () => {
  it("suma por moneda sin errores de decimales y separa lo vencido", () => {
    expect(
      saldosPorMoneda(
        [
          f(0.1),
          f(0.2),
          f(100.1, 0, "2026-01-01"),
          f(0, 50),
          f(1000, 0, "2026-11-01", "MXN"),
        ],
        "2026-11-25",
      ),
    ).toEqual([
      { moneda: "MXN", facturas: 1, saldo: 1000, vencido: 0 },
      { moneda: "USD", facturas: 3, saldo: 100.4, vencido: 100.1 },
    ]);
  });
  it("sin saldos no hay renglones", () => {
    expect(saldosPorMoneda([f(0, 10)], "2026-11-25")).toEqual([]);
  });
});
