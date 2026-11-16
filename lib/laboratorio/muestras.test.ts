import { describe, expect, it } from "vitest";
import { esquemaCampos, valoresIniciales } from "@/lib/forms/campos";
import {
  accionesMuestra,
  camposMuestra,
  estadoInicial,
  validarMuestra,
} from "./muestras";

const EQUIPO = "11111111-1111-4111-8111-111111111111";
const opciones = {
  equipos: [{ value: EQUIPO, label: "11B113 · BYPASA" }],
  ordenes: [],
  oportunidades: [],
};
const base = {
  equipo_cliente_id: EQUIPO,
  tipo: "filtrado",
  tomada_por: "mot",
  fecha_muestreo: "2026-06-17",
  fecha_recepcion: "",
  id_muestra: "",
  nivel_analisis: "",
  id_caso: "",
  punto_muestreo: "",
  condicion_operacion: "",
  orden_id: "",
  oportunidad_id: "",
  notas: "",
};

describe("camposMuestra", () => {
  const alta = camposMuestra(false, opciones, "2026-06-17");
  const edicion = camposMuestra(true, opciones, "2026-06-17");
  const valida = (campos: typeof alta, v: Record<string, string>) =>
    esquemaCampos(campos, validarMuestra).safeParse(v);

  it("al registrar propone hoy y que la tomó MOT", () => {
    const v = valoresIniciales(alta);
    expect(v.fecha_muestreo).toBe("2026-06-17");
    expect(v.tomada_por).toBe("mot");
  });

  it("al registrar el ID puede quedar vacío; al corregir, no", () => {
    expect(valida(alta, base).success).toBe(true);
    expect(valida(edicion, { ...base, estado: "pendiente" }).success).toBe(
      false,
    );
    expect(
      valida(edicion, {
        ...base,
        estado: "pendiente",
        id_muestra: "260617-092",
      }).success,
    ).toBe(true);
  });

  it("el ID escrito a mano respeta el formato AAMMDD-NNN", () => {
    expect(valida(alta, { ...base, id_muestra: "260617-092" }).success).toBe(
      true,
    );
    expect(valida(alta, { ...base, id_muestra: "17/06-92" }).success).toBe(
      false,
    );
  });

  it("solo ofrece ligar a una orden u oportunidad si el cliente tiene alguna", () => {
    expect(alta.some((c) => c.name === "orden_id")).toBe(false);
    const con = camposMuestra(
      false,
      { ...opciones, ordenes: [{ value: EQUIPO, label: "261102 DV" }] },
      "2026-06-17",
    );
    expect(con.some((c) => c.name === "orden_id")).toBe(true);
    expect(con.some((c) => c.name === "oportunidad_id")).toBe(false);
  });

  it("el estado solo se elige al corregir", () => {
    expect(alta.some((c) => c.name === "estado")).toBe(false);
    expect(edicion.some((c) => c.name === "estado")).toBe(true);
  });

  it("no acepta una recepción anterior al muestreo", () => {
    expect(
      valida(alta, { ...base, fecha_recepcion: "2026-06-16" }).success,
    ).toBe(false);
    expect(
      valida(alta, { ...base, fecha_recepcion: "2026-06-17" }).success,
    ).toBe(true);
  });

  it("recibida, en análisis o concluida piden fecha de recepción", () => {
    const v = { ...base, id_muestra: "260617-092" };
    for (const estado of ["recibida", "en_analisis", "concluida"])
      expect(valida(edicion, { ...v, estado }).success).toBe(false);
    expect(valida(edicion, { ...v, estado: "cancelada" }).success).toBe(true);
    expect(
      valida(edicion, {
        ...v,
        estado: "en_analisis",
        fecha_recepcion: "2026-06-18",
      }).success,
    ).toBe(true);
  });
});

describe("estado de la muestra", () => {
  it("nace recibida si ya trae fecha de recepción", () => {
    expect(estadoInicial("2026-06-18")).toBe("recibida");
    expect(estadoInicial(null)).toBe("pendiente");
  });

  it("solo una muestra por recibir se puede marcar como recibida", () => {
    expect(accionesMuestra("pendiente").recibir).toBe(true);
    expect(accionesMuestra("recibida").recibir).toBe(false);
    expect(accionesMuestra("cancelada").recibir).toBe(false);
  });
});
