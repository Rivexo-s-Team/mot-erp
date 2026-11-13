import { describe, expect, it } from "vitest";
import {
  esquemaCampos,
  valoresIniciales,
  type Valores,
} from "@/lib/forms/campos";
import {
  accionesOrden,
  camposOrden,
  SIN_OPCIONES,
  validarOrden,
} from "./campos";

const ID = (n: number) =>
  `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`;

describe("orden de servicio", () => {
  it("una visita pide planta; el taller no", () => {
    const visita = camposOrden("visita", SIN_OPCIONES, "2026-11-12", true);
    const taller = camposOrden("taller", SIN_OPCIONES, "2026-11-12", true);
    expect(visita.map((c) => c.name)).toContain("planta_id");
    expect(taller.map((c) => c.name)).not.toContain("planta_id");
    expect(taller.map((c) => c.name)).toContain("robox_id");
  });

  it("el técnico que crea su orden no elige responsable", () => {
    const campos = camposOrden("visita", SIN_OPCIONES, "2026-11-12", false);
    expect(campos.map((c) => c.name)).not.toContain("tecnico_id");
  });

  it("propone hoy y a quien captura como responsable", () => {
    const campos = camposOrden(
      "taller",
      SIN_OPCIONES,
      "2026-11-12",
      true,
      ID(1),
    );
    const valores = valoresIniciales(campos);
    expect(valores.fecha_programada).toBe("2026-11-12");
    expect(valores.tecnico_id).toBe(ID(1));
  });

  const campos = camposOrden("visita", SIN_OPCIONES, "2026-11-12", true);
  const esquema = esquemaCampos(campos, validarOrden);
  const base: Valores = {
    ...valoresIniciales(campos),
    planta_id: ID(2),
    tecnico_id: ID(1),
  };

  it("exige planta, técnico y fecha", () => {
    expect(esquema.safeParse(base).success).toBe(true);
    expect(esquema.safeParse({ ...base, planta_id: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, tecnico_id: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, fecha_programada: "" }).success).toBe(
      false,
    );
  });

  it("el acompañante no puede ser el mismo técnico", () => {
    expect(esquema.safeParse({ ...base, acompanante_id: ID(1) }).success).toBe(
      false,
    );
    expect(esquema.safeParse({ ...base, acompanante_id: ID(3) }).success).toBe(
      true,
    );
  });
});

describe("accionesOrden", () => {
  it("programada: se edita, se inicia y se cancela", () => {
    expect(accionesOrden("programada")).toEqual({
      editar: true,
      iniciar: true,
      cancelar: true,
      cerrar: false,
      reactivar: false,
    });
  });
  it("en curso: ya no se inicia", () => {
    expect(accionesOrden("en_curso").iniciar).toBe(false);
    expect(accionesOrden("en_curso").editar).toBe(true);
    expect(accionesOrden("en_curso").cerrar).toBe(true);
  });
  it("cerrada: nada", () => {
    expect(Object.values(accionesOrden("cerrada")).some(Boolean)).toBe(false);
  });
  it("cancelada: solo se reactiva", () => {
    expect(accionesOrden("cancelada")).toEqual({
      editar: false,
      iniciar: false,
      cancelar: false,
      cerrar: false,
      reactivar: true,
    });
  });
});
