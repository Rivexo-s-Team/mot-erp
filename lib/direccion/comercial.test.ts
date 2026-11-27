import { describe, expect, it } from "vitest";
import { resumenComercial, type OportunidadDelTablero } from "./comercial";

const o = (
  etapa: string,
  extra: Partial<OportunidadDelTablero> = {},
): OportunidadDelTablero => ({
  etapa,
  tipo: "nuevo",
  volumen_estimado_l: null,
  fecha_cierre: null,
  siguiente_paso_fecha: null,
  motivo: null,
  ...extra,
});

const DESDE = "2026-01-01T00:00:00-06:00";
const HOY = "2026-11-27";

describe("resumenComercial", () => {
  const r = resumenComercial(
    [
      o("primer_contacto", { siguiente_paso_fecha: "2026-11-20" }),
      o("visita", {
        tipo: "ampliacion",
        volumen_estimado_l: 800,
        siguiente_paso_fecha: "2026-12-05",
      }),
      o("visita", { volumen_estimado_l: 1200.5 }),
      o("ganada", { fecha_cierre: "2026-06-01T18:00:00+00:00" }),
      o("perdida", {
        fecha_cierre: "2026-07-01T18:00:00+00:00",
        motivo: "Precio",
      }),
      o("perdida", {
        fecha_cierre: "2026-08-01T18:00:00+00:00",
        motivo: "Precio",
      }),
      o("perdida", { fecha_cierre: "2026-09-01T18:00:00+00:00", motivo: " " }),
      o("descartada", {
        fecha_cierre: "2026-10-01T18:00:00+00:00",
        motivo: "Sin presupuesto por ahora",
        siguiente_paso_fecha: "2026-11-01",
      }),
      // Antes del periodo: no cuenta.
      o("ganada", { fecha_cierre: "2025-12-31T18:00:00+00:00" }),
    ],
    DESDE,
    HOY,
  );

  it("cuenta las abiertas por etapa y por tipo, en el orden del tablero", () => {
    expect(r.abiertas).toBe(3);
    expect(
      r.porEtapa
        .filter((e) => e.cantidad > 0)
        .map((e) => [e.etapa, e.cantidad]),
    ).toEqual([
      ["primer_contacto", 1],
      ["visita", 2],
    ]);
    expect(r.porEtapa[0]!.label).toBe("Primer contacto");
    expect(r.porTipo.map((t) => t.cantidad)).toEqual([2, 1, 0]);
    expect(r.litrosEstimados).toBe(2000.5);
  });

  it("cuenta los seguimientos vencidos (también de descartadas) y las abiertas sin siguiente paso", () => {
    expect(r.seguimientosVencidos).toBe(2);
    expect(r.sinSiguientePaso).toBe(1);
  });

  it("solo cuenta lo que cerró en el periodo, y la tasa no incluye las descartadas", () => {
    expect([r.ganadas, r.perdidas, r.descartadas]).toEqual([1, 3, 1]);
    expect(r.tasaDeCierre).toBe(25);
  });

  it("agrupa los motivos, del más frecuente al menos", () => {
    expect(r.motivos).toEqual([
      { motivo: "Precio", perdidas: 2, descartadas: 0 },
      { motivo: "Sin motivo", perdidas: 1, descartadas: 0 },
      { motivo: "Sin presupuesto por ahora", perdidas: 0, descartadas: 1 },
    ]);
  });

  it("sin oportunidades decididas no hay tasa", () => {
    expect(resumenComercial([o("visita")], DESDE, HOY).tasaDeCierre).toBeNull();
  });
});
