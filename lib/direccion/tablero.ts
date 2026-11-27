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

// Por cliente y planta ----------------------------------------------------------

export type RenglonDePlanta = {
  cuenta_id: string;
  cuenta: string;
  planta_id: string | null;
  planta: string | null;
  moneda: string;
  /** Sin IVA, en el periodo. */
  facturado: number;
  renta_mensual: number;
  robox: number;
};

export type SaldoDeCuenta = {
  cuenta_id: string;
  cuenta: string;
  moneda: string;
  saldo: number;
  vencido: number;
};

export type CuentaDelTablero = {
  cuenta_id: string;
  cuenta: string;
  facturado: number;
  renta_mensual: number;
  robox: number;
  saldo: number;
  vencido: number;
  plantas: {
    planta_id: string | null;
    planta: string;
    facturado: number;
    renta_mensual: number;
    robox: number;
  }[];
};

const centavos = (n: number) => Math.round(n * 100);

/**
 * Las cuentas de una moneda con sus plantas y sus totales, de la que más
 * facturó a la que menos. El saldo es de la cuenta, no de la planta: una
 * factura puede traer cargos de varias. Suma en centavos.
 */
export function cuentasDeMoneda(
  renglones: RenglonDePlanta[],
  saldos: SaldoDeCuenta[],
  moneda: string,
): CuentaDelTablero[] {
  const porCuenta = new Map<
    string,
    CuentaDelTablero & { f: number; r: number }
  >();
  const cuenta = (id: string, nombre: string) => {
    let c = porCuenta.get(id);
    if (!c) {
      c = {
        cuenta_id: id,
        cuenta: nombre,
        facturado: 0,
        renta_mensual: 0,
        robox: 0,
        saldo: 0,
        vencido: 0,
        plantas: [],
        f: 0,
        r: 0,
      };
      porCuenta.set(id, c);
    }
    return c;
  };
  for (const x of renglones) {
    if (x.moneda !== moneda) continue;
    const c = cuenta(x.cuenta_id, x.cuenta);
    c.f += centavos(x.facturado);
    c.r += centavos(x.renta_mensual);
    c.robox += x.robox;
    c.plantas.push({
      planta_id: x.planta_id,
      planta: x.planta ?? "Sin planta",
      facturado: x.facturado,
      renta_mensual: x.renta_mensual,
      robox: x.robox,
    });
  }
  for (const s of saldos) {
    if (s.moneda !== moneda) continue;
    // Una cuenta que solo debe (sin contrato vigente ni facturas en el periodo) también sale.
    const c = cuenta(s.cuenta_id, s.cuenta);
    c.saldo = s.saldo;
    c.vencido = s.vencido;
  }
  return [...porCuenta.values()]
    .map(({ f, r, ...c }) => ({
      ...c,
      facturado: f / 100,
      renta_mensual: r / 100,
      plantas: c.plantas.sort(
        (a, b) =>
          b.facturado - a.facturado || a.planta.localeCompare(b.planta, "es"),
      ),
    }))
    .sort(
      (a, b) =>
        b.facturado - a.facturado ||
        b.renta_mensual - a.renta_mensual ||
        a.cuenta.localeCompare(b.cuenta, "es"),
    );
}

/** Saldo y vencido por cuenta y moneda a partir de las facturas por cobrar. Suma en centavos. */
export function saldosPorCuenta(
  facturas: {
    cuenta_id: string;
    cuenta: string;
    moneda: string;
    saldo: number;
    vencida: boolean;
  }[],
): SaldoDeCuenta[] {
  const m = new Map<string, { nombre: string; s: number; v: number }>();
  for (const f of facturas) {
    if (f.saldo <= 0) continue;
    const clave = `${f.cuenta_id}|${f.moneda}`;
    const t = m.get(clave) ?? { nombre: f.cuenta, s: 0, v: 0 };
    t.s += centavos(f.saldo);
    if (f.vencida) t.v += centavos(f.saldo);
    m.set(clave, t);
  }
  return [...m.entries()].map(([clave, t]) => {
    const [cuenta_id, moneda] = clave.split("|") as [string, string];
    return {
      cuenta_id,
      cuenta: t.nombre,
      moneda,
      saldo: t.s / 100,
      vencido: t.v / 100,
    };
  });
}
