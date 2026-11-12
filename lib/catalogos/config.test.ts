import { describe, expect, it } from "vitest";
import {
  aFila,
  CATALOGOS,
  describirLimite,
  esquemaCatalogo,
  getCatalogo,
  valoresIniciales,
} from "./config";

const parametros = getCatalogo("parametros-laboratorio")!;
const aceites = getCatalogo("aceites")!;

const base = {
  clave: "hierro",
  nombre: "Hierro (Fe)",
  grupo: "desgaste",
  unidad: "ppm",
  metodo: "",
  tipo_regla: "maximo",
  limite_valor: "50",
  limite_texto: "",
  base_comparacion: "usado_vs_tratado",
  orden: "240",
  activo: true,
};

describe("catálogos", () => {
  it("define los catálogos con direcciones únicas", () => {
    expect(CATALOGOS.map((c) => c.tabla).sort()).toEqual([
      "aceites",
      "actividades",
      "canales_venta",
      "fallas",
      "motivos_perdida",
      "parametros_laboratorio",
      "partes",
    ]);
    expect(new Set(CATALOGOS.map((c) => c.slug)).size).toBe(CATALOGOS.length);
  });

  it("un registro nuevo empieza activo", () => {
    expect(valoresIniciales(aceites).activo).toBe(true);
  });
});

describe("describirLimite", () => {
  it("muestra el límite como en el informe", () => {
    expect(describirLimite({ tipo_regla: "maximo", limite_valor: 15 })).toBe(
      "< 15",
    );
    expect(describirLimite({ tipo_regla: "minimo", limite_valor: 5.5 })).toBe(
      "> 5.5",
    );
    expect(
      describirLimite({ tipo_regla: "codigo_iso", limite_texto: "18/16/13" }),
    ).toBe("18/16/13");
    expect(
      describirLimite({ tipo_regla: "nominal_pct", limite_valor: 10 }),
    ).toBe("Nominal ± 10 %");
    expect(
      describirLimite({ tipo_regla: "linea_base_abs", limite_valor: 0.2 }),
    ).toBe("Virgen ± 0.2");
    expect(describirLimite({ tipo_regla: "sin_limite" })).toBe("—");
  });
});

describe("esquema de parámetros de laboratorio", () => {
  const esquema = esquemaCatalogo(parametros);

  it("acepta un máximo con su valor", () => {
    expect(esquema.safeParse(base).success).toBe(true);
  });

  it("exige el valor cuando la regla lo necesita", () => {
    expect(esquema.safeParse({ ...base, limite_valor: "" }).success).toBe(
      false,
    );
  });

  it("no acepta valor en un parámetro sin límite", () => {
    expect(
      esquema.safeParse({ ...base, tipo_regla: "sin_limite" }).success,
    ).toBe(false);
    expect(
      esquema.safeParse({ ...base, tipo_regla: "sin_limite", limite_valor: "" })
        .success,
    ).toBe(true);
  });

  it("valida el formato del código ISO", () => {
    const iso = { ...base, tipo_regla: "codigo_iso", limite_valor: "" };
    expect(
      esquema.safeParse({ ...iso, limite_texto: "18/16/13" }).success,
    ).toBe(true);
    expect(
      esquema.safeParse({ ...iso, limite_texto: "18-16-13" }).success,
    ).toBe(false);
  });

  it("rechaza números mal escritos y claves con espacios", () => {
    expect(
      esquema.safeParse({ ...base, limite_valor: "cincuenta" }).success,
    ).toBe(false);
    expect(esquema.safeParse({ ...base, clave: "Hierro Fe" }).success).toBe(
      false,
    );
  });
});

describe("aFila", () => {
  it("convierte números y vacíos", () => {
    const fila = aFila(parametros, base, false);
    expect(fila.limite_valor).toBe(50);
    expect(fila.metodo).toBeNull();
    expect(fila.orden).toBe(240);
  });

  it("al editar no manda los campos que solo se fijan al crear", () => {
    expect("clave" in aFila(parametros, base, true)).toBe(false);
    expect("clave" in aFila(parametros, base, false)).toBe(true);
  });
});
