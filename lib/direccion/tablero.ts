/**
 * Tablero de dirección: meses, series y escala de la gráfica de ingresos.
 * Sin base ni navegador. Los importes llegan sumados desde la base; aquí no
 * se hace aritmética con dinero, solo se acomodan y se dibujan.
 */

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Primer día del mes de un día "aaaa-mm-dd". */
export const inicioDeMes = (dia: string) => `${dia.slice(0, 7)}-01`;

/** Los últimos `n` meses hasta el de `hoy`, del más antiguo al actual, como primer día de cada mes. */
export function ultimosMeses(hoy: string, n: number): string[] {
  const [a, m] = hoy.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 10);
  });
}

/** Último día del mes que empieza en `mes`. */
export function finDeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** "2026-11-01" → "nov 26". */
export function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return `${MESES[m - 1]} ${String(a).slice(2)}`;
}

/** "2026-11-01" → "noviembre de 2026". */
export function nombreMesLargo(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return `${new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)))} de ${a}`;
}

export type IngresoDelMes = {
  mes: string;
  moneda: string;
  facturas: number;
  /** Sin IVA. */
  facturado: number;
  /** Con IVA. */
  facturado_total: number;
  cobrado: number;
};

export type SerieDeMoneda = { moneda: string; meses: IngresoDelMes[] };

/**
 * Una serie por moneda con todos los meses pedidos (en cero los que no
 * tuvieron movimiento). Las monedas no se suman entre sí.
 */
export function seriesPorMoneda(
  renglones: IngresoDelMes[],
  meses: string[],
): SerieDeMoneda[] {
  const monedas = [...new Set(renglones.map((r) => r.moneda))].sort();
  return monedas.map((moneda) => ({
    moneda,
    meses: meses.map(
      (mes) =>
        renglones.find((r) => r.moneda === moneda && r.mes === mes) ?? {
          mes,
          moneda,
          facturas: 0,
          facturado: 0,
          facturado_total: 0,
          cobrado: 0,
        },
    ),
  }));
}

/**
 * Tope y marcas del eje para un valor máximo: números redondos (1, 2, 2.5 o
 * 5 por una potencia de 10) en cuatro o cinco pasos.
 */
export function escala(maximo: number): { tope: number; marcas: number[] } {
  if (!(maximo > 0)) return { tope: 1, marcas: [0, 1] };
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso =
    [1, 2, 2.5, 5, 10].find((p) => p * potencia >= bruto)! * potencia;
  const pasos = Math.ceil(maximo / paso);
  return {
    tope: paso * pasos,
    marcas: Array.from({ length: pasos + 1 }, (_, i) => paso * i),
  };
}

/** Importe corto para el eje: 1500 → "1.5 k", 2000000 → "2 M". */
export function importeCorto(n: number): string {
  const f = (v: number) => String(Number(v.toFixed(1)));
  if (n >= 1_000_000) return `${f(n / 1_000_000)} M`;
  if (n >= 1_000) return `${f(n / 1_000)} k`;
  return f(n);
}
