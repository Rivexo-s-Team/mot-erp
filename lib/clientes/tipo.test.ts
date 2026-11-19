import { describe, expect, it } from "vitest";
import { nombreTipoCuenta, tipoDeCuenta } from "./tipo";

describe("prospecto o cliente", () => {
  it("sin contratos es prospecto", () => {
    expect(tipoDeCuenta([])).toBe("prospecto");
  });

  it("un borrador o un cancelado no lo vuelven cliente", () => {
    expect(tipoDeCuenta(["borrador", "cancelado"])).toBe("prospecto");
  });

  it("con un contrato vigente es cliente, aunque tenga otros", () => {
    expect(tipoDeCuenta(["terminado", "vigente", "borrador"])).toBe("cliente");
  });

  it("si solo le quedan contratos terminados es cliente anterior", () => {
    expect(tipoDeCuenta(["terminado", "cancelado"])).toBe("anterior");
    expect(nombreTipoCuenta("anterior")).toBe("Cliente anterior");
  });
});
