import { describe, expect, it } from "vitest";
import {
  esquemaCampos,
  valoresIniciales,
  type Valores,
} from "@/lib/forms/campos";
import {
  camposMovimiento,
  cantidadConSigno,
  nivelExistencia,
  textoCantidad,
  validarMovimiento,
} from "./campos";

const PARTE = "11111111-1111-4111-8111-111111111111";

describe("movimiento de inventario", () => {
  const campos = camposMovimiento([], "2026-11-13");
  const esquema = esquemaCampos(campos, validarMovimiento);
  const base: Valores = {
    ...valoresIniciales(campos),
    parte_id: PARTE,
    cantidad: "10",
  };

  it("por defecto es una entrada con fecha de hoy", () => {
    expect(base.tipo).toBe("entrada");
    expect(base.fecha).toBe("2026-11-13");
    expect(esquema.safeParse(base).success).toBe(true);
  });

  it("exige parte y cantidad", () => {
    expect(esquema.safeParse({ ...base, parte_id: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, cantidad: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, cantidad: "-3" }).success).toBe(false);
  });

  it("entradas y salidas llevan cantidad mayor que cero", () => {
    expect(esquema.safeParse({ ...base, cantidad: "0" }).success).toBe(false);
    expect(
      esquema.safeParse({ ...base, tipo: "salida", cantidad: "0" }).success,
    ).toBe(false);
  });

  it("un conteo puede dar cero", () => {
    expect(
      esquema.safeParse({ ...base, tipo: "ajuste", cantidad: "0" }).success,
    ).toBe(true);
  });

  it("las salidas se guardan restando", () => {
    expect(cantidadConSigno("entrada", 10)).toBe(10);
    expect(cantidadConSigno("salida", 2)).toBe(-2);
  });
});

describe("existencias", () => {
  it("muestra el signo del movimiento", () => {
    expect(textoCantidad(10)).toBe("+10");
    expect(textoCantidad("-2")).toBe("-2");
    expect(textoCantidad(2.5)).toBe("+2.5");
  });

  it("clasifica la existencia", () => {
    expect(nivelExistencia(8)).toBe("disponible");
    expect(nivelExistencia("0")).toBe("agotada");
    expect(nivelExistencia(-4)).toBe("negativa");
  });
});
