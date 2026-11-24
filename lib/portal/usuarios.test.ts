import { describe, expect, it } from "vitest";
import { leerUsuarioPortal } from "./usuarios";

const base = {
  nombre: "  Clara Cliente ",
  correo: " Clara@Cliente.MX ",
  puesto: "",
  password: "temporal-1234",
};

describe("leerUsuarioPortal", () => {
  it("limpia espacios y pasa el correo a minúsculas", () => {
    expect(leerUsuarioPortal(base)).toEqual({
      ok: true,
      datos: {
        nombre: "Clara Cliente",
        correo: "clara@cliente.mx",
        puesto: "",
        password: "temporal-1234",
      },
    });
  });

  it("dice qué campo no procede", () => {
    expect(leerUsuarioPortal({ ...base, nombre: "C" })).toEqual({
      ok: false,
      error: "nombre",
    });
    expect(leerUsuarioPortal({ ...base, correo: "clara" })).toEqual({
      ok: false,
      error: "correo",
    });
    expect(leerUsuarioPortal({ ...base, password: "corta" })).toEqual({
      ok: false,
      error: "password",
    });
  });

  it("no acepta campos que no son texto", () => {
    expect(leerUsuarioPortal({ ...base, correo: 5 })).toEqual({
      ok: false,
      error: "correo",
    });
  });
});
