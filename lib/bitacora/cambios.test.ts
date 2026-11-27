import { describe, expect, it } from "vitest";
import {
  cambiosDe,
  direccion,
  leerFiltros,
  nombreTabla,
  rangoDeFechas,
  resumen,
  textoValor,
} from "./cambios";

const cambio = {
  operacion: "UPDATE",
  datos_anteriores: {
    id: "1",
    estado: "borrador",
    folio: null,
    notas: "igual",
    tipo_cambio: 18.5,
    updated_at: "2026-11-01",
  },
  datos_nuevos: {
    id: "1",
    estado: "emitida",
    folio: "1024",
    notas: "igual",
    tipo_cambio: 18.6,
    updated_at: "2026-11-02",
  },
};

describe("cambiosDe", () => {
  it("en un cambio, solo los campos distintos y sin columnas técnicas", () => {
    expect(cambiosDe(cambio)).toEqual([
      { campo: "estado", antes: "borrador", despues: "emitida" },
      { campo: "folio", antes: null, despues: "1024" },
      { campo: "tipo_cambio", antes: 18.5, despues: 18.6 },
    ]);
  });
  it("en un alta, los campos con valor", () => {
    expect(
      cambiosDe({
        operacion: "INSERT",
        datos_anteriores: null,
        datos_nuevos: { id: "1", monto: 100, notas: null, activo: false },
      }),
    ).toEqual([
      { campo: "monto", antes: null, despues: 100 },
      { campo: "activo", antes: null, despues: false },
    ]);
  });
  it("en una baja, lo que había", () => {
    expect(
      cambiosDe({
        operacion: "DELETE",
        datos_anteriores: { id: "1", monto: 100 },
        datos_nuevos: null,
      }),
    ).toEqual([{ campo: "monto", antes: 100, despues: null }]);
  });
  it("compara bien los valores compuestos", () => {
    expect(
      cambiosDe({
        operacion: "UPDATE",
        datos_anteriores: { contenido: { a: 1 } },
        datos_nuevos: { contenido: { a: 1 } },
      }),
    ).toEqual([]);
  });
});

describe("textoValor y resumen", () => {
  it("escribe vacíos, sí o no, y corta lo largo", () => {
    expect(textoValor(null)).toBe("—");
    expect(textoValor(true)).toBe("Sí");
    expect(textoValor(false)).toBe("No");
    expect(textoValor("x".repeat(100), 10)).toBe("xxxxxxxxxx…");
    expect(textoValor({ a: 1 })).toBe('{"a":1}');
    expect(textoValor("x".repeat(100), 0)).toHaveLength(100);
  });
  it("lee el identificador de un usuario como su nombre y un instante como fecha", () => {
    const nombres = new Map([["u1", "Diana Dirección"]]);
    expect(textoValor("u1", 80, nombres)).toBe("Diana Dirección");
    expect(textoValor("otro", 80, nombres)).toBe("otro");
    expect(textoValor("2026-11-26T23:58:30.851948+00:00")).toBe(
      "26/11/2026 17:58",
    );
    expect(textoValor("2026-11-26")).toBe("2026-11-26");
  });
  it("resume los primeros cambios y cuenta el resto", () => {
    expect(resumen(cambio)).toBe(
      "estado: borrador → emitida · folio: — → 1024 · y 1 más",
    );
    expect(
      resumen({
        operacion: "INSERT",
        datos_anteriores: null,
        datos_nuevos: { monto: 100 },
      }),
    ).toBe("monto: 100");
  });
  it("una tabla sin nombre se muestra tal cual", () => {
    expect(nombreTabla("facturas")).toBe("Facturas");
    expect(nombreTabla("tabla_nueva")).toBe("tabla_nueva");
  });
});

describe("filtros", () => {
  const U = "11111111-1111-4111-8111-111111111111";
  it("ignora lo que no es válido", () => {
    expect(
      leerFiltros({
        tabla: "no_existe",
        operacion: "DROP",
        usuario: "x",
        registro: U,
        desde: "ayer",
        hasta: "2026-11-30",
        pagina: "-3",
      }),
    ).toEqual({
      tabla: "",
      operacion: "",
      usuario: "",
      registro: U,
      desde: "",
      hasta: "2026-11-30",
      pagina: 1,
    });
  });
  it("arma la dirección sin filtros vacíos ni la página 1", () => {
    expect(direccion({ tabla: "facturas", usuario: "", pagina: 1 })).toBe(
      "/bitacora?tabla=facturas",
    );
    expect(direccion({ tabla: "", pagina: 3 })).toBe("/bitacora?pagina=3");
    expect(direccion({})).toBe("/bitacora");
  });
  it("el rango de días es en hora de México e incluye todo el último día", () => {
    expect(rangoDeFechas({ desde: "2026-11-01", hasta: "2026-11-30" })).toEqual(
      {
        desde: "2026-11-01T00:00:00-06:00",
        antesDe: "2026-12-01T00:00:00-06:00",
      },
    );
    expect(rangoDeFechas({ desde: "", hasta: "" })).toEqual({
      desde: null,
      antesDe: null,
    });
  });
});
