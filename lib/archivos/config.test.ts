import { describe, expect, it } from "vitest";
import {
  formatTamano,
  limpiarNombre,
  MAX_BYTES,
  ARCHIVOS_PDF,
  ARCHIVOS_XML,
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

describe("tipos de archivo de una factura", () => {
  const xml = { nombre: "factura.xml", tipo: "text/xml", tamano: 4000 };

  it("el XML se acepta de las dos maneras en que lo reporta el navegador", () => {
    expect(validarArchivo(xml, ARCHIVOS_XML)).toBeNull();
    expect(
      validarArchivo({ ...xml, tipo: "application/xml" }, ARCHIVOS_XML),
    ).toBeNull();
    expect(
      validarArchivo({ ...xml, tipo: "application/pdf" }, ARCHIVOS_XML),
    ).toBe("Debe ser el archivo XML de la factura.");
  });

  it("donde va el PDF no entra una imagen ni un XML", () => {
    const pdf = {
      nombre: "factura.pdf",
      tipo: "application/pdf",
      tamano: 4000,
    };
    expect(validarArchivo(pdf, ARCHIVOS_PDF)).toBeNull();
    expect(validarArchivo({ ...pdf, tipo: "image/png" }, ARCHIVOS_PDF)).toBe(
      "Debe ser un archivo PDF.",
    );
    expect(validarArchivo(xml, ARCHIVOS_PDF)).toBe("Debe ser un archivo PDF.");
  });

  it("un XML no entra donde solo van PDF e imágenes", () => {
    expect(validarArchivo(xml)).toMatch(/PDF o imágenes/);
  });
});
