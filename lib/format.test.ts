import { describe, expect, it } from "vitest";
import {
  formatDia,
  formatFecha,
  formatFechaHora,
  formatImporte,
  hoyEnMexico,
} from "./format";

describe("formatFecha", () => {
  it("usa dd/mm/aaaa", () => {
    expect(formatFecha("2026-11-02T18:00:00Z")).toBe("02/11/2026");
  });

  it("usa la zona de México, no UTC", () => {
    // 03:00 UTC del día 3 todavía es día 2 en México (UTC-6).
    expect(formatFecha("2026-11-03T03:00:00Z")).toBe("02/11/2026");
  });
});

describe("formatFechaHora", () => {
  it("usa reloj de 24 horas", () => {
    expect(formatFechaHora("2026-11-02T21:05:00Z")).toBe("02/11/2026 15:05");
    expect(formatFechaHora("2026-11-02T06:30:00Z")).toBe("02/11/2026 00:30");
  });
});

describe("formatImporte", () => {
  it("muestra dos decimales y la moneda", () => {
    expect(formatImporte("1234.5", "USD")).toBe("1,234.50 USD");
    expect(formatImporte(2.5, "USD")).toBe("2.50 USD");
  });

  it("no pierde precisión con importes grandes en texto", () => {
    expect(formatImporte("12345678901234567.89", "MXN")).toBe(
      "12,345,678,901,234,567.89 MXN",
    );
  });
});

describe("formatDia", () => {
  it("no cambia el día al pasar por la zona horaria", () => {
    expect(formatDia("2026-11-02")).toBe("02/11/2026");
    expect(formatDia("2026-01-01")).toBe("01/01/2026");
  });
});

describe("hoyEnMexico", () => {
  it("usa el día de México aunque en UTC ya sea el siguiente", () => {
    expect(hoyEnMexico(new Date("2026-11-03T03:00:00Z"))).toBe("2026-11-02");
    expect(hoyEnMexico(new Date("2026-11-02T18:00:00Z"))).toBe("2026-11-02");
  });
});
