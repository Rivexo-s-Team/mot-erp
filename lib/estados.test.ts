import { describe, expect, it } from "vitest";
import { tonoDeEstado, VARIANTE_DE_TONO } from "./estados";

describe("colores de estado", () => {
  it("verde para lo terminado o al corriente", () => {
    expect(tonoDeEstado("orden", "cerrada")).toBe("exito");
    expect(tonoDeEstado("cobro", "pagada")).toBe("exito");
    expect(tonoDeEstado("contrato", "vigente")).toBe("exito");
    expect(tonoDeEstado("informe", "validado")).toBe("exito");
  });

  it("ámbar para lo pendiente y rojo para lo vencido o crítico", () => {
    expect(tonoDeEstado("cobro", "parcial")).toBe("aviso");
    expect(tonoDeEstado("documento", "por_vencer")).toBe("aviso");
    expect(tonoDeEstado("documento", "vencido")).toBe("peligro");
    expect(tonoDeEstado("condicion", "critico")).toBe("peligro");
  });

  it("gris para borradores, cancelados y estados desconocidos", () => {
    expect(tonoDeEstado("factura", "borrador")).toBe("neutro");
    expect(tonoDeEstado("orden", "cancelada")).toBe("neutro");
    expect(tonoDeEstado("orden", "otro")).toBe("neutro");
  });

  it("cada tono tiene su etiqueta", () => {
    expect(VARIANTE_DE_TONO.peligro).toBe("destructive");
    expect(VARIANTE_DE_TONO.exito).toBe("exito");
  });
});
