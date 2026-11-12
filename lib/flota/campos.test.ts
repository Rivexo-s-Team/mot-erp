import { describe, expect, it } from "vitest";
import { aFila, esquemaCampos, valoresIniciales } from "@/lib/forms/campos";
import { CAMPOS_ROBOX, ESTADOS_ROBOX, etiquetaEstado } from "./campos";

describe("Robox", () => {
  const esquema = esquemaCampos(CAMPOS_ROBOX);
  const base = {
    numero_serie: "545592",
    modelo: "",
    version_programa: "6.5",
    sim: "",
    estado: "en_cliente",
    fecha_alta: "",
    notas: "",
  };

  it("los estados son los cuatro del diseño", () => {
    expect(ESTADOS_ROBOX.map((e) => e.value)).toEqual([
      "disponible",
      "en_cliente",
      "en_taller",
      "baja",
    ]);
    expect(etiquetaEstado("en_taller")).toBe("En taller");
  });

  it("solo exige número de serie y estado", () => {
    expect(esquema.safeParse(base).success).toBe(true);
    expect(esquema.safeParse({ ...base, numero_serie: "" }).success).toBe(
      false,
    );
    expect(esquema.safeParse({ ...base, estado: "" }).success).toBe(false);
  });

  it("valida el estado y la fecha de alta", () => {
    expect(esquema.safeParse({ ...base, estado: "perdido" }).success).toBe(
      false,
    );
    expect(
      esquema.safeParse({ ...base, fecha_alta: "15/01/2026" }).success,
    ).toBe(false);
    expect(
      esquema.safeParse({ ...base, fecha_alta: "2026-01-15" }).success,
    ).toBe(true);
  });

  it("un Robox nuevo empieza como disponible", () => {
    expect(valoresIniciales(CAMPOS_ROBOX).estado).toBe("disponible");
  });

  it("guarda vacíos como null", () => {
    const fila = aFila(CAMPOS_ROBOX, base, false);
    expect(fila.modelo).toBeNull();
    expect(fila.fecha_alta).toBeNull();
    expect(fila.version_programa).toBe("6.5");
  });
});
