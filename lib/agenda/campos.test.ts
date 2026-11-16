import { describe, expect, it } from "vitest";
import {
  esquemaCampos,
  valoresIniciales,
  type Valores,
} from "@/lib/forms/campos";
import {
  agruparPorDia,
  camposVisita,
  cercania,
  textoFrecuencia,
} from "./campos";

describe("frecuencia", () => {
  it("se lee en singular y en plural", () => {
    expect(textoFrecuencia(1, "meses")).toBe("Cada mes");
    expect(textoFrecuencia(2, "semanas")).toBe("Cada 2 semanas");
    expect(textoFrecuencia(15, "dias")).toBe("Cada 15 días");
    expect(textoFrecuencia(1, "dias")).toBe("Cada día");
  });
});

describe("cercania", () => {
  it("distingue atrasada, hoy y próxima", () => {
    expect(cercania("2026-11-15", "2026-11-16")).toBe("atrasada");
    expect(cercania("2026-11-16", "2026-11-16")).toBe("hoy");
    expect(cercania("2026-12-02", "2026-11-16")).toBe("proxima");
  });
});

describe("agruparPorDia", () => {
  it("junta lo del mismo día, en el orden en que viene", () => {
    const ordenes = [
      { folio: "A", fecha: "2026-11-16" },
      { folio: "B", fecha: "2026-11-16" },
      { folio: "C", fecha: "2026-11-18" },
    ];
    expect(agruparPorDia(ordenes, (o) => o.fecha)).toEqual([
      { dia: "2026-11-16", elementos: [ordenes[0], ordenes[1]] },
      { dia: "2026-11-18", elementos: [ordenes[2]] },
    ]);
    expect(agruparPorDia([], (o: { fecha: string }) => o.fecha)).toEqual([]);
  });
});

describe("visita recurrente", () => {
  const campos = camposVisita([], [], [], "2026-11-16");
  const esquema = esquemaCampos(campos);
  const base: Valores = valoresIniciales(campos);

  it("por defecto es cada mes, activa y a partir de hoy", () => {
    expect(base).toMatchObject({
      cada_cantidad: "1",
      cada_unidad: "meses",
      proxima_fecha: "2026-11-16",
      activa: true,
    });
    expect(esquema.safeParse(base).success).toBe(true);
  });

  it("exige frecuencia y próxima fecha", () => {
    expect(esquema.safeParse({ ...base, cada_cantidad: "" }).success).toBe(
      false,
    );
    expect(esquema.safeParse({ ...base, proxima_fecha: "" }).success).toBe(
      false,
    );
    expect(esquema.safeParse({ ...base, cada_unidad: "años" }).success).toBe(
      false,
    );
  });
});
