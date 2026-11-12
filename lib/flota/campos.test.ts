import { describe, expect, it } from "vitest";
import { aFila, esquemaCampos, valoresIniciales } from "@/lib/forms/campos";
import {
  CAMPOS_ROBOX,
  camposAsignacion,
  camposCarrusel,
  camposMovimiento,
  ESTADOS_ROBOX,
  etiquetaEstado,
  nombreEquipo,
  problemaMovimiento,
  validarAsignacion,
} from "./campos";

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

const ID = (n: number) =>
  `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`;

describe("asignación", () => {
  const contratos = [{ value: ID(1), label: "GOPLAS · Renta · Lechería" }];

  it("al asignar pide contrato y fecha, con hoy por defecto", () => {
    const campos = camposAsignacion(contratos, "2026-11-12", false);
    expect(campos.map((c) => c.name)).toEqual([
      "contrato_id",
      "fecha_inicio",
      "notas",
    ]);
    const valores = valoresIniciales(campos);
    expect(valores.fecha_inicio).toBe("2026-11-12");
    const esquema = esquemaCampos(campos, validarAsignacion);
    expect(esquema.safeParse(valores).success).toBe(false);
    expect(esquema.safeParse({ ...valores, contrato_id: ID(1) }).success).toBe(
      true,
    );
  });

  it("al editar se puede terminar, pero no antes del inicio", () => {
    const campos = camposAsignacion(contratos, "2026-11-12", true);
    const esquema = esquemaCampos(campos, validarAsignacion);
    const base = {
      contrato_id: ID(1),
      fecha_inicio: "2026-01-10",
      fecha_fin: "",
      notas: "",
    };
    expect(esquema.safeParse(base).success).toBe(true);
    expect(
      esquema.safeParse({ ...base, fecha_fin: "2026-06-30" }).success,
    ).toBe(true);
    expect(
      esquema.safeParse({ ...base, fecha_fin: "2026-01-09" }).success,
    ).toBe(false);
  });
});

describe("carrusel y movimientos", () => {
  it("el carrusel solo exige el equipo", () => {
    const campos = camposCarrusel([{ value: ID(2), label: "11B116" }]);
    const esquema = esquemaCampos(campos);
    const valores = valoresIniciales(campos);
    expect(esquema.safeParse(valores).success).toBe(false);
    expect(
      esquema.safeParse({ ...valores, equipo_cliente_id: ID(2) }).success,
    ).toBe(true);
  });

  it("un movimiento lo hace MOT por defecto", () => {
    const campos = camposMovimiento([], "2026-11-12");
    expect(valoresIniciales(campos).movido_por).toBe("mot");
    expect(
      esquemaCampos(campos).safeParse({
        ...valoresIniciales(campos),
        equipo_destino_id: ID(2),
        movido_por: "vecino",
      }).success,
    ).toBe(false);
  });

  it("nombra el equipo con su alias", () => {
    expect(nombreEquipo({ identificador: "11B116", alias: "REP4" })).toBe(
      "11B116 (REP4)",
    );
    expect(nombreEquipo({ identificador: "11B113", alias: null })).toBe(
      "11B113",
    );
  });

  const base = {
    fecha: "2026-03-01",
    destinoId: ID(2),
    tanqueActualId: ID(3),
    carruselIds: [ID(2), ID(3)],
    inicioAsignacion: "2026-01-10",
    ultimoMovimiento: "2026-02-10",
  };

  it("acepta un movimiento a otro tanque del carrusel", () => {
    expect(problemaMovimiento(base)).toBeNull();
    expect(
      problemaMovimiento({
        ...base,
        tanqueActualId: null,
        ultimoMovimiento: null,
      }),
    ).toBeNull();
  });

  it("rechaza tanque fuera del carrusel, el mismo tanque y fechas hacia atrás", () => {
    expect(problemaMovimiento({ ...base, destinoId: ID(4) })).toMatch(
      /carrusel/,
    );
    expect(problemaMovimiento({ ...base, destinoId: ID(3) })).toMatch(
      /ya está/,
    );
    expect(problemaMovimiento({ ...base, fecha: "2026-01-09" })).toMatch(
      /inicio/,
    );
    expect(problemaMovimiento({ ...base, fecha: "2026-02-09" })).toMatch(
      /último movimiento/,
    );
    expect(problemaMovimiento({ ...base, fecha: "2026-02-10" })).toBeNull();
  });
});
