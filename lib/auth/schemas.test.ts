import { describe, expect, it } from "vitest";
import {
  cambiarPasswordSchema,
  crearUsuarioSchema,
  editarUsuarioSchema,
  loginSchema,
} from "./schemas";

const rolId = "7b0c1a52-6f5e-4c0e-9a57-2d0a1f3b9c11";

describe("loginSchema", () => {
  it("normaliza el correo", () => {
    const r = loginSchema.parse({ correo: "  Diana@MOT.test ", password: "x" });
    expect(r.correo).toBe("diana@mot.test");
  });

  it("rechaza correos inválidos y contraseñas vacías", () => {
    expect(
      loginSchema.safeParse({ correo: "diana", password: "x" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ correo: "d@mot.test", password: "" }).success,
    ).toBe(false);
  });
});

describe("crearUsuarioSchema", () => {
  const base = {
    nombre: "Tomás Técnico",
    correo: "tomas@mot.test",
    puesto: "",
    rolId,
  };

  it("exige contraseña de al menos 10 caracteres", () => {
    expect(
      crearUsuarioSchema.safeParse({ ...base, password: "corta" }).success,
    ).toBe(false);
    expect(
      crearUsuarioSchema.safeParse({ ...base, password: "larga-y-segura" })
        .success,
    ).toBe(true);
  });

  it("exige un rol válido", () => {
    expect(
      crearUsuarioSchema.safeParse({
        ...base,
        rolId: "",
        password: "larga-y-segura",
      }).success,
    ).toBe(false);
  });
});

describe("editarUsuarioSchema", () => {
  const base = {
    id: rolId,
    nombre: "Tomás Técnico",
    puesto: "Campo",
    rolId,
    activo: true,
  };

  it("permite dejar la contraseña vacía (no cambiarla)", () => {
    expect(
      editarUsuarioSchema.safeParse({ ...base, password: "" }).success,
    ).toBe(true);
  });

  it("si se cambia, la contraseña también debe ser larga", () => {
    expect(
      editarUsuarioSchema.safeParse({ ...base, password: "corta" }).success,
    ).toBe(false);
  });
});

describe("cambiarPasswordSchema", () => {
  it("exige que las dos contraseñas coincidan", () => {
    expect(
      cambiarPasswordSchema.safeParse({
        password: "larga-y-segura",
        confirmar: "larga-y-otra",
      }).success,
    ).toBe(false);
    expect(
      cambiarPasswordSchema.safeParse({
        password: "larga-y-segura",
        confirmar: "larga-y-segura",
      }).success,
    ).toBe(true);
  });

  it("exige al menos 10 caracteres", () => {
    expect(
      cambiarPasswordSchema.safeParse({ password: "corta", confirmar: "corta" })
        .success,
    ).toBe(false);
  });
});
