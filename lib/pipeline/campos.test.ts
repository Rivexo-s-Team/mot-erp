import { describe, expect, it } from "vitest";
import { esquemaCampos, valoresIniciales } from "@/lib/forms/campos";
import {
  camposEtapa,
  camposActividad,
  camposOportunidad,
  ETAPAS,
  ETAPAS_ABIERTAS,
  validarEtapa,
  avisoDeMuestras,
} from "./campos";

const ID = "7b0c1a52-6f5e-4c0e-9a57-2d0a1f3b9c11";

describe("etapas", () => {
  it("son las 9 confirmadas, en el orden del proceso", () => {
    expect(ETAPAS.map((e) => e.value)).toEqual([
      "primer_contacto",
      "presentacion",
      "visita",
      "muestra",
      "resultados_laboratorio",
      "cotizacion",
      "seguimiento",
      "ganada",
      "perdida",
    ]);
    expect(ETAPAS_ABIERTAS).toHaveLength(7);
  });
});

describe("oportunidad", () => {
  const campos = camposOportunidad([], [], []);
  const esquema = esquemaCampos(campos);
  const base = {
    nombre: "Renta de Robox",
    planta_id: "",
    tipo: "nuevo",
    origen: "prospeccion",
    responsable_id: ID,
    canal_venta_id: "",
    volumen_estimado_l: "",
    notas: "",
  };

  it("acepta lo mínimo: nombre, tipo, origen y responsable", () => {
    expect(esquema.safeParse(base).success).toBe(true);
  });

  it("exige responsable interno; el canal externo es opcional", () => {
    expect(esquema.safeParse({ ...base, responsable_id: "" }).success).toBe(
      false,
    );
    expect(esquema.safeParse({ ...base, canal_venta_id: ID }).success).toBe(
      true,
    );
  });

  it("valida tipo, origen y volumen", () => {
    expect(esquema.safeParse({ ...base, tipo: "otro" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, origen: "feria" }).success).toBe(false);
    expect(
      esquema.safeParse({ ...base, volumen_estimado_l: "mucho" }).success,
    ).toBe(false);
  });
});

describe("actividad", () => {
  const campos = camposActividad([], "2026-11-10", ID);

  it("propone hoy y a quien la captura", () => {
    const v = valoresIniciales(campos);
    expect(v.fecha).toBe("2026-11-10");
    expect(v.responsable_id).toBe(ID);
  });

  it("valida la fecha", () => {
    const esquema = esquemaCampos(campos);
    const base = {
      tipo: "llamada",
      fecha: "2026-11-10",
      responsable_id: ID,
      notas: "",
    };
    expect(esquema.safeParse(base).success).toBe(true);
    expect(esquema.safeParse({ ...base, fecha: "10/11/2026" }).success).toBe(
      false,
    );
    expect(esquema.safeParse({ ...base, fecha: "" }).success).toBe(false);
  });
});

describe("cambio de etapa", () => {
  const esquema = esquemaCampos(camposEtapa([]), validarEtapa);
  const sin = { motivo_perdida_id: "", motivo_perdida: "" };

  it("perdida exige un motivo de la lista o escrito; las demás etapas no", () => {
    expect(esquema.safeParse({ etapa: "perdida", ...sin }).success).toBe(false);
    expect(
      esquema.safeParse({ etapa: "perdida", ...sin, motivo_perdida_id: ID })
        .success,
    ).toBe(true);
    expect(
      esquema.safeParse({ etapa: "perdida", ...sin, motivo_perdida: "Precio" })
        .success,
    ).toBe(true);
    expect(esquema.safeParse({ etapa: "ganada", ...sin }).success).toBe(true);
  });

  it("rechaza etapas que no existen", () => {
    expect(esquema.safeParse({ etapa: "negociacion", ...sin }).success).toBe(
      false,
    );
  });
});

describe("avisoDeMuestras", () => {
  const m = (estado: string) => ({ estado });

  it("antes de la etapa Muestra, avisa que ya hay una registrada", () => {
    for (const etapa of ["primer_contacto", "presentacion", "visita"])
      expect(avisoDeMuestras(etapa, [m("pendiente")])).toMatch(/etapa Muestra/);
    expect(avisoDeMuestras("visita", [])).toBeNull();
    expect(avisoDeMuestras("visita", [m("cancelada")])).toBeNull();
  });

  it("en la etapa Muestra, avisa si falta registrarla o si ya hay resultados", () => {
    expect(avisoDeMuestras("muestra", [])).toMatch(/aún no registra/);
    expect(avisoDeMuestras("muestra", [m("en_analisis")])).toBeNull();
    expect(
      avisoDeMuestras("muestra", [m("en_analisis"), m("concluida")]),
    ).toMatch(/Resultados de laboratorio/);
  });

  it("después ya no avisa nada", () => {
    for (const etapa of [
      "resultados_laboratorio",
      "cotizacion",
      "ganada",
      "perdida",
    ])
      expect(avisoDeMuestras(etapa, [m("concluida")])).toBeNull();
  });
});
