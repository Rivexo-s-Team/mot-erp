import { describe, expect, it } from "vitest";
import { aFila, esquemaCampos } from "@/lib/forms/campos";
import {
  CAMPOS_RAZON_SOCIAL,
  camposContacto,
  camposPlanta,
  direccionPlanta,
} from "./campos";

const rs = {
  razon_social: "Rassini Frenos, S.A. de C.V.",
  rfc: "rfr010101ab1",
  regimen_fiscal: "601",
  codigo_postal_fiscal: "76800",
  uso_cfdi: "g03",
  usa_portal_proveedores: true,
  notas: "",
};

describe("razón social", () => {
  const esquema = esquemaCampos(CAMPOS_RAZON_SOCIAL);

  it("acepta el RFC en minúsculas y lo guarda en mayúsculas", () => {
    const r = esquema.safeParse(rs);
    expect(r.success).toBe(true);
    const fila = aFila(CAMPOS_RAZON_SOCIAL, r.data!, false);
    expect(fila.rfc).toBe("RFR010101AB1");
    expect(fila.uso_cfdi).toBe("G03");
    expect(fila.notas).toBeNull();
  });

  it("rechaza un RFC mal formado", () => {
    expect(esquema.safeParse({ ...rs, rfc: "RFR-010101" }).success).toBe(false);
  });

  it("los datos fiscales opcionales pueden ir vacíos, pero no mal escritos", () => {
    expect(
      esquema.safeParse({
        ...rs,
        regimen_fiscal: "",
        codigo_postal_fiscal: "",
        uso_cfdi: "",
      }).success,
    ).toBe(true);
    expect(
      esquema.safeParse({ ...rs, codigo_postal_fiscal: "7680" }).success,
    ).toBe(false);
    expect(
      esquema.safeParse({ ...rs, regimen_fiscal: "General" }).success,
    ).toBe(false);
  });
});

describe("contacto", () => {
  const esquema = esquemaCampos(camposContacto([]));
  const base = {
    nombre: "Jair Ocampo",
    area: "mantenimiento",
    puesto: "",
    planta_id: "",
    telefono_celular: "55 4018 9999",
    telefono_oficina: "",
    correo: "",
    recibe_facturas: false,
    recibe_informes: true,
    notas: "",
  };

  it("acepta un contacto sin planta ni correo", () => {
    expect(esquema.safeParse(base).success).toBe(true);
  });

  it("valida área, correo, teléfono y planta", () => {
    expect(esquema.safeParse({ ...base, area: "ventas" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, correo: "jair@" }).success).toBe(false);
    expect(
      esquema.safeParse({ ...base, telefono_celular: "cinco cinco" }).success,
    ).toBe(false);
    expect(esquema.safeParse({ ...base, planta_id: "no-es-id" }).success).toBe(
      false,
    );
  });
});

describe("planta", () => {
  it("solo el nombre es obligatorio", () => {
    const campos = camposPlanta([]);
    const vacio = Object.fromEntries(campos.map((c) => [c.name, ""]));
    expect(
      esquemaCampos(campos).safeParse({ ...vacio, nombre: "BYPASA" }).success,
    ).toBe(true);
    expect(esquemaCampos(campos).safeParse(vacio).success).toBe(false);
  });

  it("arma la dirección con lo que haya", () => {
    expect(
      direccionPlanta({
        calle: "Oriente 6",
        numero_exterior: null,
        numero_interior: null,
        colonia: "Nuevo San Juan",
        municipio: "San Juan del Río",
        estado: "Querétaro",
        codigo_postal: null,
      }),
    ).toBe("Oriente 6, Nuevo San Juan, San Juan del Río, Querétaro");
    expect(
      direccionPlanta({
        calle: "Av. Uno",
        numero_exterior: "12",
        numero_interior: "B",
        colonia: null,
        municipio: null,
        estado: null,
        codigo_postal: "76800",
      }),
    ).toBe("Av. Uno 12 int. B, C.P. 76800");
  });
});
