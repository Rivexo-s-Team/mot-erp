import { describe, expect, it } from "vitest";
import { esquemaCampos, valoresIniciales } from "@/lib/forms/campos";
import {
  antiguedadDeSaldos,
  CAMPOS_PORTAL,
  diasDeAtraso,
  nombreEstadoPortal,
  ordenExcedida,
  textoAtraso,
  totalesPorMoneda,
  tramoDe,
  validarPortal,
} from "./cobranza";

const R1 = "11111111-1111-4111-8111-111111111111";
const R2 = "22222222-2222-4222-8222-222222222222";

describe("días de atraso", () => {
  it("cuenta desde el vencimiento: fecha más días de crédito", () => {
    const f = { fecha: "2037-01-01", dias_credito: 30 };
    expect(diasDeAtraso(f, "2037-01-31")).toBe(0);
    expect(diasDeAtraso(f, "2037-01-21")).toBe(-10);
    expect(diasDeAtraso(f, "2037-02-01")).toBe(1);
  });

  it("de contado, vence el mismo día", () => {
    expect(
      diasDeAtraso({ fecha: "2037-03-10", dias_credito: 0 }, "2037-03-12"),
    ).toBe(2);
  });

  it("se reparte en tramos de 30 días", () => {
    expect([-5, 0, 1, 30, 31, 60, 61, 90, 91, 400].map(tramoDe)).toEqual([
      "por_vencer",
      "por_vencer",
      "d1_30",
      "d1_30",
      "d31_60",
      "d31_60",
      "d61_90",
      "d61_90",
      "mas_90",
      "mas_90",
    ]);
  });

  it("se dice en palabras", () => {
    expect(textoAtraso(0)).toBe("Vence hoy");
    expect(textoAtraso(-1)).toBe("Vence en 1 día");
    expect(textoAtraso(45)).toBe("Vencida hace 45 días");
  });
});

describe("antigüedad de saldos", () => {
  const hoy = "2037-06-30";
  const f = (
    razon_social_id: string,
    moneda: string,
    fecha: string,
    dias_credito: number,
    saldo: number,
  ) => ({ razon_social_id, moneda, fecha, dias_credito, saldo });

  const renglones = antiguedadDeSaldos(
    [
      f(R1, "USD", "2037-06-20", 30, 100.1), // por vencer
      f(R1, "USD", "2037-05-20", 30, 200.2), // vencida 11 días
      f(R1, "USD", "2037-05-25", 30, 0.7), // vencida 6 días
      f(R1, "USD", "2037-01-01", 30, 50), // más de 90
      f(R1, "MXN", "2037-04-01", 30, 1160), // 60 días: 31 a 60
      f(R2, "USD", "2037-06-01", 0, 348), // 29 días
      f(R2, "USD", "2037-06-01", 0, 0), // pagada: no cuenta
    ],
    hoy,
  );

  it("da un renglón por razón social y moneda", () => {
    expect(
      renglones.map((r) => [r.razon_social_id, r.moneda, r.facturas]),
    ).toEqual([
      [R1, "USD", 4],
      [R1, "MXN", 1],
      [R2, "USD", 1],
    ]);
  });

  it("reparte el saldo por tramo sin perder centavos", () => {
    expect(renglones[0]).toMatchObject({
      tramos: {
        por_vencer: 100.1,
        d1_30: 200.9,
        d31_60: 0,
        d61_90: 0,
        mas_90: 50,
      },
      vencido: 250.9,
      total: 351,
    });
    expect(renglones[1]?.tramos.d31_60).toBe(1160);
  });

  it("totaliza por moneda, sin mezclarlas", () => {
    expect(totalesPorMoneda(renglones)).toEqual([
      { moneda: "USD", vencido: 598.9, total: 699 },
      { moneda: "MXN", vencido: 1160, total: 1160 },
    ]);
  });

  it("sin facturas no hay renglones", () => {
    expect(antiguedadDeSaldos([], hoy)).toEqual([]);
  });
});

describe("portal de proveedores", () => {
  const esquema = esquemaCampos(CAMPOS_PORTAL, validarPortal);
  const base = valoresIniciales(CAMPOS_PORTAL);

  it("nace pendiente de subir, sin fechas", () => {
    expect(base.estado).toBe("pendiente_subir");
    expect(esquema.safeParse(base).success).toBe(true);
  });

  it("subida pide su fecha", () => {
    expect(esquema.safeParse({ ...base, estado: "subida" }).success).toBe(
      false,
    );
    expect(
      esquema.safeParse({
        ...base,
        estado: "subida",
        fecha_subida: "2037-06-01",
      }).success,
    ).toBe(true);
  });

  it("no se aprueba antes de subirse", () => {
    expect(
      validarPortal({
        estado: "aprobada",
        fecha_subida: "2037-06-10",
        fecha_aprobacion: "2037-06-01",
        fecha_pago_programado: "",
        notas: "",
      })?.campo,
    ).toBe("fecha_aprobacion");
  });

  it("nombra el estado; sin seguimiento es pendiente de subir", () => {
    expect(nombreEstadoPortal("programada")).toBe("Programada para pago");
    expect(nombreEstadoPortal(null)).toBe("Pendiente de subir");
  });
});

describe("orden de compra", () => {
  it("se excede cuando el saldo es negativo; sin monto no aplica", () => {
    expect(ordenExcedida({ monto: 1000, facturado: 1200, saldo: -200 })).toBe(
      true,
    );
    expect(ordenExcedida({ monto: 1000, facturado: 1000, saldo: 0 })).toBe(
      false,
    );
    expect(ordenExcedida({ monto: null, facturado: 400, saldo: null })).toBe(
      false,
    );
  });
});
