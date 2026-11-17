import { describe, expect, it } from "vitest";
import { esquemaCampos } from "@/lib/forms/campos";
import {
  CAMPOS_COMPLEMENTO,
  esImporte,
  estadoCobro,
  FORMAS_DE_PAGO_RECIBIDO,
  leerPago,
  requiereComplemento,
} from "./pagos";

const RAZON = "11111111-1111-4111-8111-111111111111";
const F1 = "22222222-2222-4222-8222-222222222222";
const F2 = "33333333-3333-4333-8333-333333333333";
const base = {
  razon_social: RAZON,
  fecha: "2026-11-20",
  monto: "464.00",
  moneda: "USD",
  tipo_cambio: "",
  forma_pago: "03",
  referencia: " SPEI 8841 ",
  notas: "",
  [`aplicar_${F1}`]: "116",
  [`aplicar_${F2}`]: "",
};

describe("estadoCobro", () => {
  it("según lo pagado y el saldo", () => {
    expect(estadoCobro({ pagado: 0, saldo: 116 })).toBe("pendiente");
    expect(estadoCobro({ pagado: 50, saldo: 66 })).toBe("parcial");
    expect(estadoCobro({ pagado: 116, saldo: 0 })).toBe("pagada");
  });
});

describe("esImporte", () => {
  it("acepta números positivos con hasta dos decimales", () => {
    for (const v of ["116", "116.5", "116.50", "0.01"])
      expect(esImporte(v), v).toBe(true);
    for (const v of ["0", "0.00", "116.505", "1,160", "-5", "", "abc", "1e3"])
      expect(esImporte(v), v).toBe(false);
  });
});

describe("leerPago", () => {
  it("lee los datos y solo las facturas con monto", () => {
    const r = leerPago(base);
    expect(r).toEqual({
      ok: true,
      datos: {
        razon_social: RAZON,
        fecha: "2026-11-20",
        monto: "464.00",
        moneda: "USD",
        tipo_cambio: "",
        forma_pago: "03",
        referencia: "SPEI 8841",
        notas: "",
      },
      aplicaciones: [{ factura_id: F1, monto: "116" }],
    });
  });

  it("un pago puede registrarse sin aplicarlo todavía", () => {
    const r = leerPago({ ...base, [`aplicar_${F1}`]: "" });
    expect(r.ok && r.aplicaciones).toEqual([]);
  });

  it("pide fecha, monto y forma de pago", () => {
    const error = (extra: Record<string, string>) => {
      const r = leerPago({ ...base, ...extra });
      return r.ok ? null : r.error;
    };
    expect(error({ fecha: "" })).toMatch(/fecha/);
    expect(error({ monto: "0" })).toMatch(/monto recibido/);
    expect(error({ monto: "1,000" })).toMatch(/monto recibido/);
    expect(error({ forma_pago: "" })).toMatch(/forma de pago/);
    expect(error({ razon_social: "" })).toMatch(/razón social/);
  });

  it("no acepta la forma 99: un pago recibido ya tiene forma", () => {
    expect(leerPago({ ...base, forma_pago: "99" }).ok).toBe(false);
    expect(FORMAS_DE_PAGO_RECIBIDO.some((f) => f.value === "99")).toBe(false);
  });

  it("el tipo de cambio es opcional y no va en un pago en pesos", () => {
    expect(leerPago({ ...base, tipo_cambio: "18.25" }).ok).toBe(true);
    expect(leerPago({ ...base, tipo_cambio: "0" }).ok).toBe(false);
    expect(leerPago({ ...base, moneda: "MXN", tipo_cambio: "18.25" }).ok).toBe(
      false,
    );
    expect(leerPago({ ...base, moneda: "MXN" }).ok).toBe(true);
  });

  it("rechaza montos a aplicar mal escritos", () => {
    expect(leerPago({ ...base, [`aplicar_${F2}`]: "50.555" }).ok).toBe(false);
    expect(leerPago({ ...base, [`aplicar_${F2}`]: "-1" }).ok).toBe(false);
    expect(leerPago({ ...base, aplicar_otra: "10" }).ok).toBe(false);
  });
});

describe("complemento de pago", () => {
  it("lleva folio y folio fiscal", () => {
    const ok = (v: Record<string, string>) =>
      esquemaCampos(CAMPOS_COMPLEMENTO).safeParse(v).success;
    expect(
      ok({
        rep_folio: "P-12",
        rep_uuid: "5c1b6a2e-3f4d-4a8b-9c0d-1e2f3a4b5c6d",
      }),
    ).toBe(true);
    expect(
      ok({ rep_folio: "", rep_uuid: "5c1b6a2e-3f4d-4a8b-9c0d-1e2f3a4b5c6d" }),
    ).toBe(false);
    expect(ok({ rep_folio: "P-12", rep_uuid: "123" })).toBe(false);
  });

  it("se necesita cuando el pago cubre alguna factura PPD", () => {
    expect(requiereComplemento(["PUE", "PPD"])).toBe(true);
    expect(requiereComplemento(["PUE", null])).toBe(false);
    expect(requiereComplemento([])).toBe(false);
  });
});
