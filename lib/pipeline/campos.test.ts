import { describe, expect, it } from "vitest";
import { esquemaCampos, valoresIniciales } from "@/lib/forms/campos";
import {
  CAMPOS_ETAPA,
  camposActividad,
  camposOportunidad,
  ETAPAS,
  ETAPAS_ABIERTAS,
  validarEtapa,
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
  const esquema = esquemaCampos(CAMPOS_ETAPA, validarEtapa);

  it("perdida exige motivo; las demás no", () => {
    expect(
      esquema.safeParse({ etapa: "perdida", motivo_perdida: "" }).success,
    ).toBe(false);
    expect(
      esquema.safeParse({ etapa: "perdida", motivo_perdida: "Precio" }).success,
    ).toBe(true);
    expect(
      esquema.safeParse({ etapa: "ganada", motivo_perdida: "" }).success,
    ).toBe(true);
  });

  it("rechaza etapas que no existen", () => {
    expect(
      esquema.safeParse({ etapa: "negociacion", motivo_perdida: "" }).success,
    ).toBe(false);
  });
});
