import { describe, expect, it } from "vitest";
import {
  esquemaCampos,
  valoresIniciales,
  type Valores,
} from "@/lib/forms/campos";
import {
  camposCargo,
  centavosATexto,
  conceptoMalUso,
  porCompletar,
  totalesPendientes,
} from "./campos";

describe("cargo", () => {
  const campos = camposCargo(false);
  const esquema = esquemaCampos(campos);
  const base: Valores = {
    ...valoresIniciales(campos),
    tipo: "partes_mal_uso",
    concepto: "Bomba dañada",
    precio_unitario: "850",
  };

  it("por defecto es una pieza en USD", () => {
    expect(base.cantidad).toBe("1");
    expect(base.moneda).toBe("USD");
    expect(esquema.safeParse(base).success).toBe(true);
  });

  it("exige tipo y concepto; el precio puede quedar pendiente", () => {
    expect(esquema.safeParse({ ...base, tipo: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, concepto: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, precio_unitario: "" }).success).toBe(
      true,
    );
  });

  it("a mano no se captura el cargo por litros", () => {
    expect(esquema.safeParse({ ...base, tipo: "evento_litro" }).success).toBe(
      false,
    );
  });

  it("al editar se puede cancelar, pero no marcar facturado", () => {
    const edicion = camposCargo(true, "evento_litro");
    const estado = edicion.find((c) => c.name === "estado");
    expect(estado?.opciones?.map((o) => o.value)).toEqual([
      "pendiente",
      "cancelado",
    ]);
    expect(
      edicion.find((c) => c.name === "tipo")?.opciones?.map((o) => o.value),
    ).toContain("evento_litro");
  });

  it("detecta el cargo por completar", () => {
    expect(porCompletar({ cantidad: 2000, precio_unitario: 3.75 })).toBe(false);
    expect(porCompletar({ cantidad: null, precio_unitario: 3.75 })).toBe(true);
    expect(porCompletar({ cantidad: 2000, precio_unitario: null })).toBe(true);
  });

  it("propone el concepto del cargo por partes dañadas", () => {
    expect(conceptoMalUso("261102 DV", [])).toBe(
      "Partes dañadas por el cliente, orden 261102 DV",
    );
    expect(conceptoMalUso("261102 DV", ["Bomba M (1)", "Cable (2)"])).toBe(
      "Partes dañadas por el cliente, orden 261102 DV: Bomba M (1), Cable (2)",
    );
  });
});

describe("totalesPendientes", () => {
  it("suma por moneda solo lo pendiente y completo, sin errores de decimales", () => {
    const totales = totalesPendientes([
      { estado: "pendiente", moneda: "USD", importe: 7500 },
      { estado: "pendiente", moneda: "USD", importe: 6939.38 },
      { estado: "pendiente", moneda: "USD", importe: 0.1 },
      { estado: "pendiente", moneda: "USD", importe: 0.2 },
      { estado: "pendiente", moneda: "MXN", importe: 1200.5 },
      { estado: "cancelado", moneda: "USD", importe: 999 },
      { estado: "pendiente", moneda: "USD", importe: null },
    ]);
    expect(
      totales.map((t) => `${centavosATexto(t.centavos)} ${t.moneda}`),
    ).toEqual(["1200.50 MXN", "14439.68 USD"]);
  });

  it("sin cargos no hay totales", () => {
    expect(totalesPendientes([])).toEqual([]);
    expect(centavosATexto(BigInt(5))).toBe("0.05");
  });
});
