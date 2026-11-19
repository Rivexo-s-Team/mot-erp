import { describe, expect, it } from "vitest";
import { coincide, normalizar } from "./buscar";

describe("búsqueda en listas", () => {
  it("ignora acentos y mayúsculas", () => {
    expect(normalizar("  Lechería ")).toBe("lecheria");
    expect(coincide("lecheria", ["GOPLAS", "Lechería"])).toBe(true);
    expect(coincide("QUERÉTARO", ["Planta queretaro"])).toBe(true);
  });

  it("cada palabra debe aparecer en algún texto", () => {
    expect(
      coincide("rassini 102", ["Rassini Ejemplo SA de CV", "DEMO 102"]),
    ).toBe(true);
    expect(
      coincide("rassini 999", ["Rassini Ejemplo SA de CV", "DEMO 102"]),
    ).toBe(false);
  });

  it("vacía coincide con todo; ignora nulos y acepta números", () => {
    expect(coincide("", ["x"])).toBe(true);
    expect(coincide("   ", [])).toBe(true);
    expect(coincide("348", [null, undefined, 348])).toBe(true);
  });
});
