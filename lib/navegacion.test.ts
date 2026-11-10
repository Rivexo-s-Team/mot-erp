import { describe, expect, it } from "vitest";
import { estaActiva, menuPara } from "./navegacion";

const hrefs = (permisos: string[]) =>
  menuPara(permisos).flatMap((g) => g.entradas.map((e) => e.href));

describe("menuPara", () => {
  it("Dirección ve todo", () => {
    expect(hrefs(["catalogos.ver", "usuarios.administrar"])).toEqual([
      "/",
      "/catalogos",
      "/usuarios",
    ]);
  });

  it("un técnico ve catálogos pero no usuarios", () => {
    expect(hrefs(["catalogos.ver"])).toEqual(["/", "/catalogos"]);
  });

  it("sin permisos solo queda Inicio y no hay grupos vacíos", () => {
    const menu = menuPara([]);
    expect(menu).toHaveLength(1);
    expect(hrefs([])).toEqual(["/"]);
  });
});

describe("estaActiva", () => {
  it("marca la sección aunque estés en una subpágina", () => {
    expect(estaActiva("/catalogos", "/catalogos/partes/nuevo")).toBe(true);
    expect(estaActiva("/usuarios", "/usuarios")).toBe(true);
  });

  it("Inicio solo se marca en la página de inicio", () => {
    expect(estaActiva("/", "/")).toBe(true);
    expect(estaActiva("/", "/catalogos")).toBe(false);
  });

  it("no confunde rutas que empiezan igual", () => {
    expect(estaActiva("/usuarios", "/usuarios-portal")).toBe(false);
  });
});
