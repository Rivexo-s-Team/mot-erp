import { describe, expect, it } from "vitest";
import {
  esquemaCampos,
  valoresIniciales,
  type Valores,
} from "@/lib/forms/campos";
import {
  camposContrato,
  camposTarifa,
  partidasATarifas,
  textoVigencia,
  validarContrato,
  type PartidaCotizada,
} from "./campos";

const PLANTA = "11111111-1111-4111-8111-111111111111";
const EQUIPO = "22222222-2222-4222-8222-222222222222";

describe("contrato", () => {
  const campos = camposContrato([{ value: PLANTA, label: "Lechería" }], [], []);
  const esquema = esquemaCampos(campos, validarContrato);
  const base: Valores = {
    ...valoresIniciales(campos),
    planta_id: PLANTA,
    tipo: "renta",
  };

  it("nace en borrador y en USD", () => {
    expect(base.estado).toBe("borrador");
    expect(base.moneda).toBe("USD");
  });

  it("solo exige planta, tipo, estado y moneda", () => {
    expect(esquema.safeParse(base).success).toBe(true);
    expect(esquema.safeParse({ ...base, planta_id: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, tipo: "" }).success).toBe(false);
  });

  it("no acepta la prueba tecnológica como tipo (D14)", () => {
    expect(
      esquema.safeParse({ ...base, tipo: "prueba_tecnologica" }).success,
    ).toBe(false);
  });

  it("el término no puede ser anterior al inicio", () => {
    const fechas = { fecha_inicio: "2024-04-01", fecha_termino: "2027-03-31" };
    expect(esquema.safeParse({ ...base, ...fechas }).success).toBe(true);
    expect(
      esquema.safeParse({ ...base, ...fechas, fecha_termino: "2024-03-31" })
        .success,
    ).toBe(false);
  });

  it("toma la moneda de la cotización cuando viene de una", () => {
    const conPesos = camposContrato([], [], [], "MXN");
    expect(valoresIniciales(conPesos).moneda).toBe("MXN");
  });
});

describe("tarifa", () => {
  const campos = camposTarifa([], "USD");
  const esquema = esquemaCampos(campos);
  const base: Valores = {
    ...valoresIniciales(campos),
    concepto: "Renta",
    precio: "289",
  };

  it("por defecto se cobra por mes", () => {
    expect(base.unidad).toBe("mes");
    expect(esquema.safeParse(base).success).toBe(true);
  });

  it("exige concepto y precio numérico", () => {
    expect(esquema.safeParse({ ...base, concepto: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, precio: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, precio: "-5" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, precio: "289.50" }).success).toBe(true);
  });
});

describe("partidasATarifas", () => {
  const partida = (p: Partial<PartidaCotizada>): PartidaCotizada => ({
    orden: 0,
    concepto: "Renta mensual de Robox",
    unidad: "mes",
    precio_unitario: "289",
    importe: "10404.00",
    recurrente: true,
    equipo_cliente_id: null,
    equipo_planta_id: null,
    ...p,
  });

  it("la renta conserva su precio mensual, no el importe total", () => {
    expect(partidasATarifas([partida({})], PLANTA)).toEqual([
      {
        orden: 1,
        concepto: "Renta mensual de Robox",
        unidad: "mes",
        precio: "289",
        equipo_cliente_id: null,
      },
    ]);
  });

  it("un servicio de una sola vez pasa como pago único con su importe", () => {
    const [t] = partidasATarifas(
      [
        partida({
          concepto: "Instalación",
          unidad: "servicio",
          precio_unitario: "250",
          importe: "500.00",
          recurrente: false,
        }),
      ],
      PLANTA,
    );
    expect(t).toMatchObject({ unidad: "unico", precio: "500.00" });
  });

  it("el precio por litro se conserva", () => {
    const [t] = partidasATarifas(
      [
        partida({
          unidad: "litro",
          precio_unitario: "3.5",
          importe: "7000.00",
          recurrente: false,
        }),
      ],
      PLANTA,
    );
    expect(t).toMatchObject({ unidad: "litro", precio: "3.5" });
  });

  it("solo conserva el equipo si es de la planta del contrato", () => {
    const [propio, ajeno] = partidasATarifas(
      [
        partida({ equipo_cliente_id: EQUIPO, equipo_planta_id: PLANTA }),
        partida({ equipo_cliente_id: EQUIPO, equipo_planta_id: "otra" }),
      ],
      PLANTA,
    );
    expect(propio?.equipo_cliente_id).toBe(EQUIPO);
    expect(ajeno?.equipo_cliente_id).toBeNull();
  });

  it("respeta el orden de la cotización", () => {
    const t = partidasATarifas(
      [partida({ orden: 5 }), partida({ orden: 0 })],
      PLANTA,
    );
    expect(t.map((x) => x.orden)).toEqual([5, 2]);
  });
});

describe("textoVigencia", () => {
  const f = (d: string) => d.split("-").reverse().join("/");
  it("describe lo que se sabe", () => {
    expect(textoVigencia("2024-04-01", "2027-03-31", f)).toBe(
      "01/04/2024 al 31/03/2027",
    );
    expect(textoVigencia(null, "2027-03-31", f)).toBe("Hasta el 31/03/2027");
    expect(textoVigencia("2024-04-01", null, f)).toBe("Desde el 01/04/2024");
    expect(textoVigencia(null, null, f)).toBe("Sin fechas");
  });
});
