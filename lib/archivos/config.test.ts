import { describe, expect, it } from "vitest";
import {
  formatTamano,
  limpiarNombre,
  MAX_BYTES,
  validarArchivo,
} from "./config";

describe("validarArchivo", () => {
  const pdf = {
    nombre: "informe.pdf",
    tipo: "application/pdf",
    tamano: 200_000,
  };

  it("acepta PDF e imágenes", () => {
    expect(validarArchivo(pdf)).toBeNull();
    expect(
      validarArchivo({ ...pdf, nombre: "frasco.jpg", tipo: "image/jpeg" }),
    ).toBeNull();
  });

  it("rechaza otros tipos de archivo", () => {
    expect(validarArchivo({ ...pdf, tipo: "application/zip" })).toMatch(
      /PDF o imágenes/,
    );
    expect(validarArchivo({ ...pdf, tipo: "text/html" })).toMatch(
      /PDF o imágenes/,
    );
  });

  it("rechaza archivos vacíos o de más de 10 MB", () => {
    expect(validarArchivo({ ...pdf, tamano: 0 })).toMatch(/vacío/);
    expect(validarArchivo({ ...pdf, tamano: MAX_BYTES + 1 })).toMatch(/10 MB/);
    expect(validarArchivo({ ...pdf, tamano: MAX_BYTES })).toBeNull();
  });
});

describe("limpiarNombre", () => {
  it("quita la ruta y recorta nombres larguísimos", () => {
    expect(limpiarNombre("C:\\Users\\jp\\informe final.pdf")).toBe(
      "informe final.pdf",
    );
    expect(limpiarNombre("../../etc/passwd")).toBe("passwd");
    expect(limpiarNombre("a".repeat(300)).length).toBe(150);
  });
});

describe("formatTamano", () => {
  it("muestra KB o MB", () => {
    expect(formatTamano(320 * 1024)).toBe("320 KB");
    expect(formatTamano(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatTamano(10)).toBe("1 KB");
  });
});
