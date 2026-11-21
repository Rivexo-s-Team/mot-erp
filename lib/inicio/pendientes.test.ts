import { describe, expect, it } from "vitest";
import { pendientes, type Conteos } from "./pendientes";

const NADA: Conteos = {
  visitasAtrasadas: null,
  visitasSemana: null,
  ordenesEnCurso: null,
  filtrosPorCambiar: null,
  muestrasEnProceso: null,
  informesBorrador: null,
  oportunidadesAbiertas: null,
  seguimientosPorHacer: null,
  cargosPorFacturar: null,
  facturasPorCobrar: null,
  facturasVencidas: null,
};

describe("tablero de inicio", () => {
  it("no muestra lo que el rol no puede ver", () => {
    expect(pendientes(NADA)).toEqual([]);
    const lab = pendientes({
      ...NADA,
      muestrasEnProceso: 2,
      informesBorrador: 0,
    });
    expect(lab.map((p) => p.clave)).toEqual(["muestras", "informes"]);
  });

  it("las visitas suman las atrasadas y las marcan en rojo", () => {
    const [v] = pendientes({ ...NADA, visitasAtrasadas: 1, visitasSemana: 3 });
    expect(v).toMatchObject({
      valor: 4,
      detalle: "1 atrasada",
      tono: "peligro",
    });
    const [sin] = pendientes({
      ...NADA,
      visitasAtrasadas: 0,
      visitasSemana: 3,
    });
    expect(sin?.tono).toBe("neutro");
  });

  it("la cobranza avisa las vencidas", () => {
    const [c] = pendientes({
      ...NADA,
      facturasPorCobrar: 5,
      facturasVencidas: 2,
    });
    expect(c).toMatchObject({
      valor: 5,
      detalle: "2 vencidas",
      tono: "peligro",
      href: "/cobranza",
    });
    const [ok] = pendientes({
      ...NADA,
      facturasPorCobrar: 5,
      facturasVencidas: 0,
    });
    expect(ok).toMatchObject({ detalle: "Ninguna vencida", tono: "neutro" });
  });

  it("en cero queda neutro; con pendientes, en ámbar", () => {
    const [cero] = pendientes({ ...NADA, cargosPorFacturar: 0 });
    expect(cero?.tono).toBe("neutro");
    const [hay] = pendientes({ ...NADA, cargosPorFacturar: 3 });
    expect(hay?.tono).toBe("aviso");
  });
});
