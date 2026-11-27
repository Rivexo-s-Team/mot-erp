import { describe, expect, it } from "vitest";
import { periodoDe, resumenOperacion } from "./operacion";

describe("periodoDe", () => {
  it("acepta solo los periodos ofrecidos", () => {
    expect(periodoDe("3")).toBe(3);
    expect(periodoDe("6")).toBe(6);
    expect(periodoDe("12")).toBe(12);
    expect(periodoDe("5")).toBe(12);
    expect(periodoDe("abc")).toBe(12);
    expect(periodoDe(undefined)).toBe(12);
    expect(periodoDe(["3", "6"])).toBe(12);
  });
});

describe("resumenOperacion", () => {
  const MESES = ["2026-09-01", "2026-10-01", "2026-11-01"];
  const HOY = "2026-11-27";
  const orden = (
    estado: string,
    fecha_programada: string,
    fecha_real: string | null = null,
    tipo = "visita",
  ) => ({ tipo, estado, fecha_programada, fecha_real });

  const r = resumenOperacion(
    {
      robox: ["en_cliente", "en_cliente", "disponible", "en_taller", "baja"],
      ordenes: [
        orden("cerrada", "2026-10-30", "2026-11-02"),
        orden("cerrada", "2026-10-10", "2026-10-10"),
        orden("cerrada", "2026-09-15"),
        orden("cerrada", "2026-08-31", "2026-08-31"),
        orden("cerrada", "2026-11-05", "2026-11-05", "taller"),
        orden("en_curso", "2026-11-26"),
        orden("programada", "2026-11-27"),
        orden("programada", "2026-12-03"),
        orden("programada", "2026-11-20"),
        orden("cancelada", "2026-11-01"),
      ],
      muestras: [
        { estado: "concluida", fecha_muestreo: "2026-10-01" },
        { estado: "recibida", fecha_muestreo: "2026-11-20" },
        { estado: "pendiente", fecha_muestreo: "2026-08-01" },
        { estado: "cancelada", fecha_muestreo: "2026-11-01" },
      ],
      informes: [
        {
          estado: "validado",
          validado_at: "2026-11-10T18:00:00+00:00",
          publicado_at: null,
        },
        {
          estado: "validado",
          validado_at: "2026-08-31T18:00:00+00:00",
          publicado_at: "2026-09-01T18:00:00+00:00",
        },
        { estado: "borrador", validado_at: null, publicado_at: null },
      ],
    },
    MESES,
    HOY,
  );

  it("mide la flota sin contar las bajas", () => {
    expect(r.robox.enServicio).toBe(4);
    expect(r.robox.enCliente).toBe(2);
    expect(r.robox.utilizacion).toBe(50);
    expect(r.robox.porEstado.map((e) => e.cantidad)).toEqual([1, 0, 2, 1, 1]);
  });

  it("cuenta las visitas cerradas en el mes en que se hicieron, sin las de taller", () => {
    expect(r.visitas.cerradas).toBe(3);
    expect(r.visitas.porMes.map((m) => m.cantidad)).toEqual([1, 1, 1]);
  });

  it("separa las programadas de hoy en adelante de las atrasadas", () => {
    expect(r.visitas).toMatchObject({
      enCurso: 1,
      programadas: 2,
      atrasadas: 1,
    });
  });

  it("resume el laboratorio: muestras del periodo, en proceso e informes", () => {
    expect(r.laboratorio).toEqual({
      muestras: 2,
      enProceso: 2,
      informesValidados: 1,
      sinPublicar: 1,
    });
  });

  it("sin flota no hay utilización", () => {
    expect(
      resumenOperacion(
        { robox: [], ordenes: [], muestras: [], informes: [] },
        MESES,
        HOY,
      ).robox.utilizacion,
    ).toBeNull();
  });
});
