import { describe, expect, it } from "vitest";
import { esquemaCampos, valoresIniciales } from "@/lib/forms/campos";
import {
  camposCredito,
  fechaVencimiento,
  resumenCredito,
  validarCredito,
} from "./credito";

const CONTACTO = "11111111-1111-4111-8111-111111111111";
const campos = camposCredito([{ value: CONTACTO, label: "Paula Pagos" }]);
const base = {
  dias_credito: "30",
  requiere_orden_compra: true,
  metodo_pago: "PPD",
  forma_pago: "99",
  contacto_cxp_id: CONTACTO,
  portal: "",
  notas: "",
};
const valida = (v: Record<string, string | boolean>) =>
  esquemaCampos(campos, validarCredito).safeParse(v).success;

describe("formulario de condiciones de crédito", () => {
  it("propone de contado y sin orden de compra", () => {
    const v = valoresIniciales(campos);
    expect(v.dias_credito).toBe("0");
    expect(v.requiere_orden_compra).toBe(false);
  });

  it("acepta crédito con PPD y forma 99", () => {
    expect(valida(base)).toBe(true);
  });

  it("método, forma, contacto y portal son opcionales", () => {
    expect(
      valida({ ...base, metodo_pago: "", forma_pago: "", contacto_cxp_id: "" }),
    ).toBe(true);
  });

  it("con PPD no acepta otra forma de pago (regla del SAT)", () => {
    expect(valida({ ...base, forma_pago: "03" })).toBe(false);
    expect(valida({ ...base, metodo_pago: "PUE", forma_pago: "03" })).toBe(
      true,
    );
  });

  it("los días son un entero de 0 a 365", () => {
    expect(valida({ ...base, dias_credito: "" })).toBe(false);
    expect(valida({ ...base, dias_credito: "30.5" })).toBe(false);
    expect(valida({ ...base, dias_credito: "366" })).toBe(false);
    expect(valida({ ...base, dias_credito: "365" })).toBe(true);
  });

  it("avisa si el cliente no tiene contactos", () => {
    const sin = camposCredito([]).find((c) => c.name === "contacto_cxp_id");
    expect(sin?.ayuda).toMatch(/aún no tiene contactos/);
  });
});

describe("resumenCredito", () => {
  it("lo dice en una línea", () => {
    expect(
      resumenCredito({
        dias_credito: 30,
        requiere_orden_compra: true,
        metodo_pago: "PPD",
      }),
    ).toBe("30 días de crédito · exige orden de compra · PPD");
    expect(
      resumenCredito({
        dias_credito: 0,
        requiere_orden_compra: false,
        metodo_pago: null,
      }),
    ).toBe("De contado");
  });
});

describe("fechaVencimiento", () => {
  it("suma días naturales y cruza de mes y de año", () => {
    expect(fechaVencimiento("2026-11-17", 30)).toBe("2026-12-17");
    expect(fechaVencimiento("2026-12-15", 30)).toBe("2027-01-14");
    expect(fechaVencimiento("2028-02-28", 1)).toBe("2028-02-29");
    expect(fechaVencimiento("2026-11-17", 0)).toBe("2026-11-17");
  });
});
