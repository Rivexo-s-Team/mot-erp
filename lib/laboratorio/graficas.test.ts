import { describe, expect, it } from "vitest";
import {
  escalaDe,
  formatoEje,
  seriesDeTendencia,
  trazar,
  type SerieTendencia,
} from "./graficas";
import type { ContenidoInforme, FilaInforme } from "./informe";

const fila = (
  nombre: string,
  textos: (string | null)[],
  extra: Partial<FilaInforme> = {},
): FilaInforme => ({
  parametroId: nombre,
  clave: nombre,
  nombre,
  unidad: "ppm",
  limite: null,
  valores: textos.map((texto) =>
    texto === null ? null : { texto, veredicto: "sin_evaluar" },
  ),
  desviacion: null,
  ...extra,
});

const contenido = (filas: FilaInforme[]): ContenidoInforme => ({
  version: 1,
  muestras: [],
  grupos: [{ grupo: "desgaste", titulo: "Elementos de desgaste", filas }],
  condicionGeneral: null,
});

const serie = (valores: number[], limites: number[] = []): SerieTendencia => ({
  parametroId: "x",
  nombre: "X",
  unidad: null,
  limite: null,
  limites,
  puntos: valores.map((valor, indice) => ({
    indice,
    texto: String(valor),
    valor,
    veredicto: "sin_evaluar",
  })),
});

describe("seriesDeTendencia", () => {
  const grupos = seriesDeTendencia(
    contenido([
      fila("Aluminio", ["0", "0", null, "80.6", "184", "169"], {
        limite: "< 15",
        limites: [15],
      }),
      fila("Titanio", ["0", "0", null, "0", "0", "0"]),
      fila("Agua", ["<300", "316.6", "159.59", "369", null, null]),
      fila("Sedimentables", ["No detectado", "No detectado"]),
      fila("TAN", ["No detectado", "0.79709", null, null]),
      fila("Código", ["21/19/14", "18/16/13"]),
    ]),
  );
  const g = grupos[0];

  it("grafica los parámetros con al menos dos números", () => {
    expect(g?.series.map((s) => s.nombre)).toEqual(["Aluminio", "Agua"]);
  });

  it("cada punto recuerda de qué muestra es y cómo se escribió", () => {
    expect(g?.series[0]?.puntos.map((p) => p.indice)).toEqual([0, 1, 3, 4, 5]);
    expect(g?.series[1]?.puntos[0]).toMatchObject({
      texto: "<300",
      valor: 300,
    });
    expect(g?.series[0]?.limites).toEqual([15]);
  });

  it("los que dan cero en todo se nombran aparte", () => {
    expect(g?.enCero).toEqual(["Titanio"]);
  });

  it("un informe validado sin límites numéricos también se grafica", () => {
    const viejo = seriesDeTendencia(
      contenido([fila("Hierro", ["13.7", "14.9"])]),
    );
    expect(viejo[0]?.series[0]?.limites).toEqual([]);
  });

  it("omite los grupos sin nada que mostrar", () => {
    expect(
      seriesDeTendencia(contenido([fila("Código", ["21/19/14"])])),
    ).toEqual([]);
  });
});

describe("escalaDe", () => {
  it("parte de cero y sube a un número redondo", () => {
    expect(escalaDe(serie([13.7, 13.6, 14.9], [50]))).toEqual({
      min: 0,
      max: 50,
      limites: [50],
    });
    expect(escalaDe(serie([1335937, 1831620, 132090]))).toMatchObject({
      min: 0,
      max: 2000000,
    });
    expect(escalaDe(serie([0.583, 8.011]))).toMatchObject({ min: 0, max: 10 });
  });

  it("se acerca cuando los valores están juntos y lejos de cero", () => {
    // Viscosidad con su rango 41.4 a 50.6
    const e = escalaDe(serie([46.435, 46.203, 47.375], [41.4, 50.6]));
    expect(e.min).toBeGreaterThan(35);
    expect(e.min).toBeLessThan(41.4);
    expect(e.max).toBeGreaterThan(50.6);
    expect(e.max).toBeLessThan(56);
  });

  it("no dibuja un límite muy por encima de los datos", () => {
    expect(escalaDe(serie([1.8, 4.3], [15]))).toMatchObject({ limites: [15] });
    expect(escalaDe(serie([1.8, 3], [15]))).toMatchObject({
      max: 5,
      limites: [],
    });
  });

  it("un límite por debajo de los datos sí se dibuja", () => {
    expect(escalaDe(serie([80.6, 184, 169], [15])).limites).toEqual([15]);
  });
});

describe("trazar", () => {
  const caja = {
    ancho: 200,
    alto: 100,
    margen: { arriba: 10, derecha: 10, abajo: 10, izquierda: 10 },
  };

  it("reparte las muestras a lo ancho y pone el cero abajo", () => {
    const t = trazar(serie([0, 50, 100]), 3, caja);
    expect(t.puntos.map((p) => [p.x, p.y])).toEqual([
      [10, 90],
      [100, 50],
      [190, 10],
    ]);
    expect(t.tramos).toHaveLength(1);
  });

  it("corta la línea donde falta una muestra", () => {
    const s = serie([1, 2, 3, 4]);
    s.puntos = s.puntos.filter((p) => p.indice !== 1);
    s.puntos.forEach((p, i) => (p.indice = [0, 2, 3][i] ?? 0));
    const t = trazar(s, 4, caja);
    // El primer punto queda suelto; el tramo une los dos últimos.
    expect(t.tramos).toHaveLength(1);
    expect(t.tramos[0]).toHaveLength(2);
    expect(t.puntos).toHaveLength(3);
  });

  it("ubica los límites en la misma escala", () => {
    const t = trazar(serie([0, 100], [50]), 2, caja);
    expect(t.limites).toEqual([{ valor: 50, y: 50 }]);
  });
});

describe("formatoEje", () => {
  it("abrevia los números grandes", () => {
    expect(formatoEje(2000000)).toBe("2 M");
    expect(formatoEje(1831620)).toBe("1.83 M");
    expect(formatoEje(72150)).toBe("72.2 k");
    expect(formatoEje(0.583)).toBe("0.583");
    expect(formatoEje(100)).toBe("100");
  });
});
