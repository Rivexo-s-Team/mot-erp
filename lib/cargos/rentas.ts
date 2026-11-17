/**
 * Rentas mensuales como cargos (DISENO §4.6). Qué rentas le tocan a un mes lo
 * decide la base (`rentas_del_mes`); aquí va lo que la pantalla necesita para
 * elegir el mes y resumir. Sin base ni navegador.
 */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-11" (como lo da el selector de mes) → "2026-11-01". Null si no es un mes válido. */
export function periodoDeMes(mes: unknown): string | null {
  if (typeof mes !== "string") return null;
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return null;
  const numero = Number(m[2]);
  const anio = Number(m[1]);
  if (numero < 1 || numero > 12 || anio < 2020 || anio > 2100) return null;
  return `${mes}-01`;
}

/** "2026-11-17" → "2026-11". */
export const mesDeDia = (dia: string) => dia.slice(0, 7);

/** "2026-11" o "2026-11-01" → "noviembre de 2026". */
export function nombreMes(mes: string): string {
  const [anio, numero] = mes.split("-");
  return `${MESES[Number(numero) - 1] ?? "?"} de ${anio}`;
}

/** El mes anterior o el siguiente: desplazarMes("2026-01", -1) → "2025-12". */
export function desplazarMes(mes: string, cuantos: number): string {
  const [anio, numero] = mes.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(anio, numero - 1 + cuantos, 1));
  return d.toISOString().slice(0, 7);
}

export type RentaDelMes = {
  tarifa_id: string;
  contrato_id: string;
  cuenta: string;
  planta: string;
  concepto: string;
  precio: number;
  moneda: string;
  parcial: boolean;
  cargo_id: string | null;
  cargo_estado: string | null;
};

export type ResumenRentas = {
  porGenerar: number;
  generadas: number;
  /** Rentas por generar de contratos que empiezan o terminan dentro del mes. */
  parciales: number;
  /** Importe por generar, por moneda, en centavos enteros. */
  totales: { moneda: string; centavos: bigint }[];
};

/** Cuántas rentas faltan por generar en el mes y cuánto suman. */
export function resumenRentas(rentas: RentaDelMes[]): ResumenRentas {
  const pendientes = rentas.filter((r) => r.cargo_id === null);
  const porMoneda = new Map<string, bigint>();
  for (const r of pendientes) {
    // En centavos enteros: no se suman decimales en JavaScript.
    const centavos = BigInt(Math.round(r.precio * 100));
    porMoneda.set(r.moneda, (porMoneda.get(r.moneda) ?? BigInt(0)) + centavos);
  }
  return {
    porGenerar: pendientes.length,
    generadas: rentas.length - pendientes.length,
    parciales: pendientes.filter((r) => r.parcial).length,
    totales: [...porMoneda.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([moneda, centavos]) => ({ moneda, centavos })),
  };
}

/** Las rentas del mes agrupadas por cliente y planta, en el orden en que llegan. */
export function rentasPorContrato(rentas: RentaDelMes[]) {
  const grupos: {
    contratoId: string;
    titulo: string;
    rentas: RentaDelMes[];
  }[] = [];
  for (const r of rentas) {
    const ultimo = grupos.at(-1);
    if (ultimo?.contratoId === r.contrato_id) ultimo.rentas.push(r);
    else
      grupos.push({
        contratoId: r.contrato_id,
        titulo: `${r.cuenta} · ${r.planta}`,
        rentas: [r],
      });
  }
  return grupos;
}
