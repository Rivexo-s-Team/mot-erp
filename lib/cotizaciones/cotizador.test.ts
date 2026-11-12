import { describe, expect, it } from "vitest";
import {
  comoPorcentaje,
  precioReferenciaDeContenedor,
  precioSugeridoPorLitro,
} from "./cotizador";

const P = { porcentaje: "0.70", piso: "2.50", monedaPiso: "USD" };

describe("precioSugeridoPorLitro", () => {
  it("70 % del aceite nuevo cuando supera el piso", () => {
    const s = precioSugeridoPorLitro("5.20", P, "USD");
    expect(s).toEqual({
      precio: "3.64",
      aplicoPiso: false,
      porPorcentaje: "3.64",
      pisoEnMoneda: "2.50",
    });
  });

  it("aplica el piso cuando el 70 % queda por debajo", () => {
    const s = precioSugeridoPorLitro("3.00", P, "USD");
    expect(s?.precio).toBe("2.50");
    expect(s?.aplicoPiso).toBe(true);
    expect(s?.porPorcentaje).toBe("2.10");
  });

  it("en el empate usa el porcentaje", () => {
    // 2.50 / 0.70 no es exacto; 3.58 × 0.70 = 2.506 → 2.51
    expect(precioSugeridoPorLitro("3.58", P, "USD")?.precio).toBe("2.51");
    expect(precioSugeridoPorLitro("3.57", P, "USD")?.precio).toBe("2.50");
  });

  it("el ejemplo de Rivexo: aceite a 100 pesos se vende en 70", () => {
    // Piso 2.50 USD × 18 = 45 MXN; 70 % de 100 = 70 MXN.
    const s = precioSugeridoPorLitro("100", P, "MXN", "18");
    expect(s?.precio).toBe("70.00");
    expect(s?.pisoEnMoneda).toBe("45.00");
  });

  it("en pesos, el piso se convierte con el tipo de cambio", () => {
    const s = precioSugeridoPorLitro("50", P, "MXN", "18.5");
    expect(s?.precio).toBe("46.25"); // piso 2.50 × 18.5; el 70 % daría 35.00
    expect(s?.aplicoPiso).toBe(true);
  });

  it("sin tipo de cambio no puede comparar contra el piso", () => {
    expect(precioSugeridoPorLitro("100", P, "MXN")).toBeNull();
    expect(precioSugeridoPorLitro("100", P, "MXN", "")).toBeNull();
  });

  it("sin precio de referencia no sugiere nada", () => {
    expect(precioSugeridoPorLitro("", P, "USD")).toBeNull();
    expect(precioSugeridoPorLitro("abc", P, "USD")).toBeNull();
  });

  it("no pierde centavos por punto flotante", () => {
    // En JavaScript 0.7 * 4.35 = 3.0449999999999995 (redondearía a 3.04).
    expect(precioSugeridoPorLitro("4.35", P, "USD")?.precio).toBe("3.05");
    expect(
      precioSugeridoPorLitro(4.35, { ...P, porcentaje: 0.7 }, "USD")?.precio,
    ).toBe("3.05");
  });

  it("usa los parámetros que recibe, no valores fijos", () => {
    const otros = { porcentaje: "0.65", piso: "3.00", monedaPiso: "USD" };
    expect(precioSugeridoPorLitro("10", otros, "USD")?.precio).toBe("6.50");
    expect(precioSugeridoPorLitro("4", otros, "USD")?.precio).toBe("3.00");
  });
});

describe("comoPorcentaje", () => {
  it("muestra la fracción como porcentaje", () => {
    expect(comoPorcentaje("0.70")).toBe("70 %");
    expect(comoPorcentaje(0.7)).toBe("70 %");
    expect(comoPorcentaje("0.655")).toBe("65.5 %");
    expect(comoPorcentaje("1")).toBe("100 %");
  });
});

describe("precioReferenciaDeContenedor", () => {
  it("el ejemplo de MOT: 2,900 USD entre 200 L da 14.50, y el 70 % es 10.15", () => {
    const referencia = precioReferenciaDeContenedor("2900", "200");
    expect(referencia).toBe("14.50");
    expect(precioSugeridoPorLitro(referencia!, P, "USD")?.precio).toBe("10.15");
  });

  it("redondea a cuatro decimales cuando la división no es exacta", () => {
    expect(precioReferenciaDeContenedor("1000", "208")).toBe("4.8077");
    expect(precioReferenciaDeContenedor("100", "3")).toBe("33.3333");
  });

  it("sin los dos datos, o con litros en cero, no calcula", () => {
    expect(precioReferenciaDeContenedor("2900", "")).toBeNull();
    expect(precioReferenciaDeContenedor("", "200")).toBeNull();
    expect(precioReferenciaDeContenedor("2900", "0")).toBeNull();
  });
});
