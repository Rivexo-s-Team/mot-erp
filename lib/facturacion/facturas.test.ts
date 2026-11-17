import { describe, expect, it } from "vitest";
import { esquemaCampos } from "@/lib/forms/campos";
import {
  accionesFactura,
  CAMPOS_CANCELACION,
  CAMPOS_CONCEPTO,
  camposEmision,
  camposFactura,
  faltantesParaTimbrar,
  folioFactura,
  validarEmision,
  validarFactura,
  type DatosParaTimbrar,
} from "./facturas";

describe("formulario de la factura", () => {
  const usd = camposFactura("USD", "2026-11-17");
  const mxn = camposFactura("MXN", "2026-11-17");
  const base = {
    fecha: "2026-11-17",
    tipo_cambio: "18.25",
    metodo_pago: "PPD",
    forma_pago: "99",
    uso_cfdi: "G03",
    dias_credito: "30",
    orden_compra: "",
    notas: "",
  };
  const valida = (campos: typeof usd, v: Record<string, string>) =>
    esquemaCampos(campos, validarFactura).safeParse(v).success;

  it("pide tipo de cambio solo si la factura no es en pesos", () => {
    expect(usd.some((c) => c.name === "tipo_cambio")).toBe(true);
    expect(mxn.some((c) => c.name === "tipo_cambio")).toBe(false);
    expect(usd.find((c) => c.name === "tipo_cambio")?.label).toBe(
      "Tipo de cambio (pesos por USD)",
    );
  });

  it("acepta un borrador completo y uno al que aún le faltan datos", () => {
    expect(valida(usd, base)).toBe(true);
    expect(
      valida(usd, {
        ...base,
        tipo_cambio: "",
        metodo_pago: "",
        forma_pago: "",
        uso_cfdi: "",
      }),
    ).toBe(true);
  });

  it("aplica las reglas del SAT y de los números", () => {
    expect(valida(usd, { ...base, forma_pago: "03" })).toBe(false);
    expect(valida(usd, { ...base, uso_cfdi: "gastos" })).toBe(false);
    expect(valida(usd, { ...base, tipo_cambio: "0" })).toBe(false);
    expect(valida(usd, { ...base, dias_credito: "400" })).toBe(false);
    expect(valida(usd, { ...base, fecha: "" })).toBe(false);
  });

  it("las claves del SAT de un concepto tienen formato", () => {
    const ok = (v: Record<string, string>) =>
      esquemaCampos(CAMPOS_CONCEPTO).safeParse(v).success;
    const c = {
      descripcion: "Renta",
      clave_prod_serv: "81141500",
      clave_unidad: "E48",
    };
    expect(ok(c)).toBe(true);
    expect(ok({ ...c, clave_prod_serv: "", clave_unidad: "" })).toBe(true);
    expect(ok({ ...c, clave_prod_serv: "8114" })).toBe(false);
    expect(ok({ ...c, descripcion: "" })).toBe(false);
  });
});

describe("faltantesParaTimbrar", () => {
  const completa: DatosParaTimbrar = {
    moneda: "USD",
    tipo_cambio: 18.25,
    metodo_pago: "PPD",
    forma_pago: "99",
    uso_cfdi: "G03",
    orden_compra: "OC-77",
    razon: { regimen_fiscal: "601", codigo_postal_fiscal: "76246" },
    requiereOrdenCompra: true,
    conceptos: [{ clave_prod_serv: "81141500", clave_unidad: "E48" }],
  };

  it("una factura completa no tiene faltantes", () => {
    expect(faltantesParaTimbrar(completa)).toEqual([]);
  });

  it("dice cada cosa que falta", () => {
    expect(
      faltantesParaTimbrar({
        ...completa,
        tipo_cambio: null,
        metodo_pago: null,
        forma_pago: null,
        uso_cfdi: null,
        orden_compra: null,
        razon: { regimen_fiscal: null, codigo_postal_fiscal: null },
        conceptos: [
          { clave_prod_serv: null, clave_unidad: "E48" },
          { clave_prod_serv: "81141500", clave_unidad: null },
        ],
      }),
    ).toEqual([
      "El régimen fiscal de la razón social.",
      "El código postal fiscal de la razón social.",
      "El uso de CFDI.",
      "El método de pago.",
      "La forma de pago.",
      "El tipo de cambio.",
      "La orden de compra: esta razón social la exige.",
      "Las claves del SAT de 2 conceptos.",
    ]);
  });

  it("en pesos no pide tipo de cambio, y la orden de compra solo si se exige", () => {
    expect(
      faltantesParaTimbrar({
        ...completa,
        moneda: "MXN",
        tipo_cambio: null,
        orden_compra: null,
        requiereOrdenCompra: false,
      }),
    ).toEqual([]);
  });

  it("sin conceptos lo dice primero", () => {
    expect(faltantesParaTimbrar({ ...completa, conceptos: [] })[0]).toBe(
      "No tiene conceptos.",
    );
  });
});

describe("registro de la factura emitida", () => {
  const usd = camposEmision("USD", "2026-11-17");
  const base = {
    serie: "A",
    folio: "1024",
    uuid_fiscal: "5c1b6a2e-3f4d-4a8b-9c0d-1e2f3a4b5c6d",
    fecha: "2026-11-17",
    tipo_cambio: "18.253",
  };
  const valida = (campos: typeof usd, v: Record<string, string>) =>
    esquemaCampos(campos, validarEmision).safeParse(v).success;

  it("pide folio, folio fiscal y fecha; la serie es opcional", () => {
    expect(valida(usd, base)).toBe(true);
    expect(valida(usd, { ...base, serie: "" })).toBe(true);
    expect(valida(usd, { ...base, folio: "" })).toBe(false);
    expect(valida(usd, { ...base, fecha: "" })).toBe(false);
  });

  it("el folio fiscal tiene forma de UUID", () => {
    expect(
      valida(usd, { ...base, uuid_fiscal: base.uuid_fiscal.toUpperCase() }),
    ).toBe(true);
    expect(
      valida(usd, { ...base, uuid_fiscal: "5c1b6a2e3f4d4a8b9c0d1e2f3a4b5c6d" }),
    ).toBe(false);
    expect(valida(usd, { ...base, uuid_fiscal: "" })).toBe(false);
  });

  it("en dólares el tipo de cambio es obligatorio; en pesos no se pide", () => {
    expect(valida(usd, { ...base, tipo_cambio: "" })).toBe(false);
    expect(valida(usd, { ...base, tipo_cambio: "0" })).toBe(false);
    const mxn = camposEmision("MXN", "2026-11-17");
    expect(mxn.some((c) => c.name === "tipo_cambio")).toBe(false);
  });

  it("la cancelación pide su motivo", () => {
    const ok = (m: string) =>
      esquemaCampos(CAMPOS_CANCELACION).safeParse({ motivo_cancelacion: m })
        .success;
    expect(ok("Se refacturó")).toBe(true);
    expect(ok("  ")).toBe(false);
  });

  it("escribe serie y folio juntos", () => {
    expect(folioFactura({ serie: "A", folio: "1024" })).toBe("A 1024");
    expect(folioFactura({ serie: null, folio: "1024" })).toBe("1024");
    expect(folioFactura({ serie: null, folio: null })).toBe("");
  });
});

describe("accionesFactura", () => {
  it("un borrador se edita, se elimina o se registra como emitido", () => {
    expect(accionesFactura("borrador")).toEqual({
      editar: true,
      eliminar: true,
      emitir: true,
      corregirRegistro: false,
      subirArchivos: false,
      cancelar: false,
    });
  });
  it("una emitida solo se corrige en su registro, recibe archivos o se cancela", () => {
    expect(accionesFactura("emitida")).toEqual({
      editar: false,
      eliminar: false,
      emitir: false,
      corregirRegistro: true,
      subirArchivos: true,
      cancelar: true,
    });
  });
  it("una cancelada no admite nada", () => {
    expect(Object.values(accionesFactura("cancelada")).some(Boolean)).toBe(
      false,
    );
  });
});
