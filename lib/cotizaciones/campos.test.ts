import { describe, expect, it } from "vitest";
import { esquemaCampos, valoresIniciales } from "@/lib/forms/campos";
import {
  camposCotizacion,
  camposPartida,
  validarCotizacion,
  validarPartida,
} from "./campos";

describe("cotización", () => {
  const esquema = esquemaCampos(camposCotizacion([]), validarCotizacion);
  const base = {
    contacto_id: "",
    numero_requisicion: "",
    condiciones_pago: "",
    moneda: "USD",
    tipo_cambio: "",
    vigencia: "",
    valor_total_contrato: "",
    litros_estimados: "",
    condiciones: "",
    notas: "",
  };

  it("una cotización nueva es en USD", () => {
    expect(valoresIniciales(camposCotizacion([])).moneda).toBe("USD");
  });

  it("en USD no pide tipo de cambio; en pesos sí", () => {
    expect(esquema.safeParse(base).success).toBe(true);
    expect(esquema.safeParse({ ...base, moneda: "MXN" }).success).toBe(false);
    expect(
      esquema.safeParse({ ...base, moneda: "MXN", tipo_cambio: "18.5" })
        .success,
    ).toBe(true);
  });

  it("acepta el valor total del contrato o los litros estimados", () => {
    expect(
      esquema.safeParse({ ...base, valor_total_contrato: "54000" }).success,
    ).toBe(true);
    expect(
      esquema.safeParse({ ...base, litros_estimados: "1200" }).success,
    ).toBe(true);
    expect(
      esquema.safeParse({ ...base, litros_estimados: "muchos" }).success,
    ).toBe(false);
  });
});

describe("partida", () => {
  const campos = camposPartida([]);
  const esquema = esquemaCampos(campos, validarPartida);
  const base = {
    concepto: "Limpieza de aceite por litro",
    equipo_cliente_id: "",
    unidad: "litro",
    cantidad: "280",
    recurrente: false,
    numero_parte_cliente: "",
    referencia_costo_contenedor: "",
    referencia_litros_contenedor: "",
    precio_referencia: "",
    fuente_tipo: "",
    fuente_url: "",
    fecha_referencia: "",
    precio_unitario: "3.64",
    orden: "0",
  };

  it("partida libre: concepto, unidad, cantidad y precio", () => {
    expect(esquema.safeParse(base).success).toBe(true);
    expect(
      esquema.safeParse({
        ...base,
        concepto: "Renta mensual",
        unidad: "mes",
        cantidad: "36",
        recurrente: true,
        precio_unitario: "1500",
      }).success,
    ).toBe(true);
  });

  it("por litro puede ir sin precio si hay precio de referencia con su fuente", () => {
    const conReferencia = {
      ...base,
      precio_unitario: "",
      precio_referencia: "5.20",
    };
    expect(esquema.safeParse(conReferencia).success).toBe(false); // falta la fuente
    expect(
      esquema.safeParse({ ...conReferencia, fuente_tipo: "internet" }).success,
    ).toBe(true);
  });

  it("sin precio ni referencia no se puede guardar", () => {
    expect(esquema.safeParse({ ...base, precio_unitario: "" }).success).toBe(
      false,
    );
  });

  it("el precio de referencia solo aplica por litro", () => {
    expect(
      esquema.safeParse({
        ...base,
        unidad: "mes",
        precio_referencia: "5.20",
        fuente_tipo: "internet",
      }).success,
    ).toBe(false);
  });

  it("valida unidad y cantidad", () => {
    expect(esquema.safeParse({ ...base, unidad: "kilo" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, cantidad: "" }).success).toBe(false);
  });

  it("acepta el costo del contenedor con sus litros en lugar del precio por litro", () => {
    const contenedor = {
      ...base,
      precio_unitario: "",
      referencia_costo_contenedor: "2900",
      referencia_litros_contenedor: "200",
      fuente_tipo: "comprobante_cliente",
    };
    expect(esquema.safeParse(contenedor).success).toBe(true);
    expect(
      esquema.safeParse({ ...contenedor, referencia_litros_contenedor: "" })
        .success,
    ).toBe(false);
    expect(
      esquema.safeParse({ ...contenedor, referencia_litros_contenedor: "0" })
        .success,
    ).toBe(false);
    expect(esquema.safeParse({ ...contenedor, fuente_tipo: "" }).success).toBe(
      false,
    );
  });
});
