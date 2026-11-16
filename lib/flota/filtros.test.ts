import { describe, expect, it } from "vitest";
import { esquemaCampos, valoresIniciales } from "@/lib/forms/campos";
import {
  camposFiltro,
  estadoFiltro,
  lecturaAgotada,
  lecturaVigente,
  motivosDeCambio,
  sumarMeses,
  validarFiltro,
} from "./filtros";

describe("sumarMeses", () => {
  it("suma meses conservando el día", () => {
    expect(sumarMeses("2026-08-20", 6)).toBe("2027-02-20");
    expect(sumarMeses("2026-01-15", 12)).toBe("2027-01-15");
  });
  it("si el día no existe en el mes destino, usa el último", () => {
    expect(sumarMeses("2026-08-31", 6)).toBe("2027-02-28");
    expect(sumarMeses("2027-08-31", 6)).toBe("2028-02-29");
    expect(sumarMeses("2026-10-31", 1)).toBe("2026-11-30");
  });
});

describe("estadoFiltro", () => {
  const f = { fechaInstalacion: "2026-08-20", meses: 6 };
  it("vence a los meses del parámetro", () => {
    expect(estadoFiltro({ ...f, hoy: "2026-11-16" })).toEqual({
      vence: "2027-02-20",
      vencido: false,
    });
  });
  it("el día que cumple los meses ya toca cambiarlo", () => {
    expect(estadoFiltro({ ...f, hoy: "2027-02-19" }).vencido).toBe(false);
    expect(estadoFiltro({ ...f, hoy: "2027-02-20" }).vencido).toBe(true);
  });
  it("respeta otro valor del parámetro", () => {
    expect(estadoFiltro({ ...f, meses: 3, hoy: "2026-11-20" }).vencido).toBe(
      true,
    );
  });
});

describe("lectura de la pantalla", () => {
  it("agotado cuando los días usados alcanzan la vida del filtro", () => {
    const l = { fecha: "2026-11-02", usados: 74, vida: 365 };
    expect(lecturaAgotada(l)).toBe(false);
    expect(lecturaAgotada({ ...l, usados: 365 })).toBe(true);
    expect(lecturaAgotada({ ...l, usados: 400 })).toBe(true);
  });
  it("sin vida del filtro no se puede saber", () => {
    expect(
      lecturaAgotada({ fecha: "2026-11-02", usados: 74, vida: null }),
    ).toBe(false);
    expect(lecturaAgotada({ fecha: "2026-11-02", usados: 74, vida: 0 })).toBe(
      false,
    );
    expect(lecturaAgotada(null)).toBe(false);
  });
});

describe("motivosDeCambio", () => {
  const base = {
    filtros: [
      { nombre: "Filtro SKF500/HY (Core)", fechaInstalacion: "2026-08-20" },
    ],
    lectura: { fecha: "2026-11-02", usados: 74, vida: 365 },
    meses: 6,
    hoy: "2026-11-16",
  };

  it("el caso de Rassini está en orden", () => {
    expect(motivosDeCambio(base)).toEqual([]);
  });

  it("avisa cuando el filtro cumple los meses", () => {
    expect(motivosDeCambio({ ...base, hoy: "2027-03-01" })).toEqual([
      "Filtro SKF500/HY (Core): ya cumplió 6 meses instalado.",
    ]);
  });

  it("avisa cuando la pantalla marca el filtro agotado, aunque no cumpla los meses", () => {
    expect(
      motivosDeCambio({
        ...base,
        lectura: { fecha: "2026-11-02", usados: 365, vida: 365 },
      }),
    ).toEqual(["La pantalla del Robox marca 365 de 365 días de filtro."]);
  });

  it("puede haber los dos motivos, y ninguno si no hay datos", () => {
    expect(
      motivosDeCambio({
        ...base,
        hoy: "2027-03-01",
        lectura: { fecha: "2027-02-25", usados: 190, vida: 180 },
      }),
    ).toHaveLength(2);
    expect(
      motivosDeCambio({ filtros: [], lectura: null, meses: 6, hoy: base.hoy }),
    ).toEqual([]);
  });

  it("una lectura anterior al filtro puesto ya no cuenta", () => {
    const agotada = { fecha: "2026-11-16", usados: 370, vida: 365 };
    // El filtro se cambió en esa misma visita: la lectura era del anterior.
    const cambiado = [
      { nombre: "Filtro SKF500/HY (Core)", fechaInstalacion: "2026-11-16" },
    ];
    expect(lecturaVigente(agotada, cambiado)).toBe(false);
    expect(
      motivosDeCambio({ ...base, filtros: cambiado, lectura: agotada }),
    ).toEqual([]);
    // Si el filtro es de antes, la lectura sí habla de él.
    expect(lecturaVigente(agotada, base.filtros)).toBe(true);
    // Sin filtros registrados, la lectura es lo único que hay: cuenta.
    expect(lecturaVigente(agotada, [])).toBe(true);
    expect(lecturaVigente(null, [])).toBe(false);
  });

  it("sin el parámetro solo cuenta la lectura", () => {
    expect(
      motivosDeCambio({ ...base, meses: null, hoy: "2030-01-01" }),
    ).toEqual([]);
  });
});

describe("formulario de filtro", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  it("al registrar pide filtro y fecha, con hoy por defecto", () => {
    const campos = camposFiltro([], "2026-11-16", false);
    expect(campos.map((c) => c.name)).toEqual([
      "parte_id",
      "fecha_instalacion",
      "notas",
    ]);
    const valores = valoresIniciales(campos);
    expect(valores.fecha_instalacion).toBe("2026-11-16");
    expect(esquemaCampos(campos).safeParse(valores).success).toBe(false);
    expect(
      esquemaCampos(campos).safeParse({ ...valores, parte_id: ID }).success,
    ).toBe(true);
  });
  it("al editar, el retiro no puede ser anterior a la instalación", () => {
    const campos = camposFiltro([], "", true);
    const esquema = esquemaCampos(campos, validarFiltro);
    const base = {
      parte_id: ID,
      fecha_instalacion: "2026-08-20",
      fecha_retiro: "",
      notas: "",
    };
    expect(esquema.safeParse(base).success).toBe(true);
    expect(
      esquema.safeParse({ ...base, fecha_retiro: "2026-08-19" }).success,
    ).toBe(false);
    expect(
      esquema.safeParse({ ...base, fecha_retiro: "2027-02-20" }).success,
    ).toBe(true);
  });
});
