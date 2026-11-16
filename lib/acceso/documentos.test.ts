import { describe, expect, it } from "vitest";
import { esquemaCampos } from "@/lib/forms/campos";
import {
  camposDocumento,
  estadoDocumento,
  impideEntrada,
  revisarAcceso,
  validarDocumento,
  type DocumentoAcceso,
} from "./documentos";

const HOY = "2026-11-16";
const REPSE = "11111111-1111-4111-8111-111111111111";
const IMSS = "22222222-2222-4222-8222-222222222222";
const ANA = "33333333-3333-4333-8333-333333333333";
const BETO = "44444444-4444-4444-8444-444444444444";

describe("estadoDocumento", () => {
  it("sin vencimiento siempre está vigente", () => {
    expect(estadoDocumento(null, HOY, 30)).toBe("vigente");
  });
  it("vence al día siguiente de su fecha", () => {
    expect(estadoDocumento("2026-11-15", HOY, 30)).toBe("vencido");
    expect(estadoDocumento("2026-11-16", HOY, 30)).toBe("por_vencer");
  });
  it("avisa dentro de los días del parámetro", () => {
    expect(estadoDocumento("2026-12-16", HOY, 30)).toBe("por_vencer");
    expect(estadoDocumento("2026-12-17", HOY, 30)).toBe("vigente");
    expect(estadoDocumento("2026-12-17", HOY, 60)).toBe("por_vencer");
    expect(estadoDocumento("2026-11-20", HOY, 0)).toBe("vigente");
  });
});

describe("revisarAcceso", () => {
  const tipos = [
    { id: REPSE, nombre: "REPSE", aplica_a: "empresa" },
    { id: IMSS, nombre: "IMSS", aplica_a: "persona" },
  ];
  const personas = [
    { id: ANA, nombre: "Ana Ruiz" },
    { id: BETO, nombre: "Beto Soto" },
  ];
  const doc = (d: Partial<DocumentoAcceso>): DocumentoAcceso => ({
    id: "d",
    tipo_id: REPSE,
    perfil_id: null,
    fecha_vencimiento: null,
    tieneArchivo: false,
    ...d,
  });
  const revisar = (documentos: DocumentoAcceso[]) =>
    revisarAcceso({ tipos, documentos, personas, hoy: HOY, avisoDias: 30 });

  it("un renglón por documento de MOT y por documento de cada persona", () => {
    const r = revisar([]);
    expect(r.map((x) => `${x.documento}/${x.de}`)).toEqual([
      "REPSE/MOT",
      "IMSS/Ana Ruiz",
      "IMSS/Beto Soto",
    ]);
    expect(r.every((x) => x.estado === "falta")).toBe(true);
    expect(r.every(impideEntrada)).toBe(true);
  });

  it("marca vigente, por vencer y vencido", () => {
    const r = revisar([
      doc({ id: "a", fecha_vencimiento: "2027-06-30", tieneArchivo: true }),
      doc({
        id: "b",
        tipo_id: IMSS,
        perfil_id: ANA,
        fecha_vencimiento: "2026-12-01",
      }),
      doc({
        id: "c",
        tipo_id: IMSS,
        perfil_id: BETO,
        fecha_vencimiento: "2026-10-01",
      }),
    ]);
    expect(r.map((x) => x.estado)).toEqual([
      "vigente",
      "por_vencer",
      "vencido",
    ]);
    expect(r[0]).toMatchObject({ documentoId: "a", tieneArchivo: true });
    expect(r.map(impideEntrada)).toEqual([false, false, true]);
  });

  it("si se renovó, cuenta el que vence más tarde", () => {
    const r = revisar([
      doc({ id: "viejo", fecha_vencimiento: "2026-01-31" }),
      doc({ id: "nuevo", fecha_vencimiento: "2027-01-31" }),
    ]);
    expect(r[0]).toMatchObject({ documentoId: "nuevo", estado: "vigente" });
  });

  it("uno sin vencimiento le gana a uno con fecha", () => {
    const r = revisar([
      doc({
        id: "con",
        tipo_id: IMSS,
        perfil_id: ANA,
        fecha_vencimiento: "2026-01-31",
      }),
      doc({ id: "sin", tipo_id: IMSS, perfil_id: ANA }),
    ]);
    expect(r[1]).toMatchObject({ documentoId: "sin", estado: "vigente" });
  });

  it("el documento de una persona no le sirve a otra, ni a MOT", () => {
    const r = revisar([doc({ id: "x", tipo_id: IMSS, perfil_id: ANA })]);
    expect(r.map((x) => x.estado)).toEqual(["falta", "vigente", "falta"]);
  });
});

describe("formulario de documento", () => {
  const campos = camposDocumento([], []);
  const esquema = esquemaCampos(campos, validarDocumento([IMSS]));
  const base = {
    tipo_id: REPSE,
    perfil_id: "",
    fecha_vencimiento: "",
    notas: "",
  };

  it("un documento de MOT va sin persona", () => {
    expect(esquema.safeParse(base).success).toBe(true);
    expect(esquema.safeParse({ ...base, perfil_id: ANA }).success).toBe(false);
  });
  it("un documento personal exige persona", () => {
    expect(esquema.safeParse({ ...base, tipo_id: IMSS }).success).toBe(false);
    expect(
      esquema.safeParse({ ...base, tipo_id: IMSS, perfil_id: ANA }).success,
    ).toBe(true);
  });
});
