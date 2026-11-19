import type { Campo, Opcion, Validador } from "@/lib/forms/campos";
import { fechaVencimiento } from "./credito";

/**
 * Cobranza: antigüedad de saldos y seguimiento de portales de proveedores.
 * Sin base ni navegador.
 */

// Antigüedad de saldos ---------------------------------------------------------

/** Tramos del reporte, por días de atraso contra el vencimiento. */
export const TRAMOS = [
  { clave: "por_vencer", label: "Por vencer" },
  { clave: "d1_30", label: "1 a 30 días" },
  { clave: "d31_60", label: "31 a 60 días" },
  { clave: "d61_90", label: "61 a 90 días" },
  { clave: "mas_90", label: "Más de 90 días" },
] as const;

export type Tramo = (typeof TRAMOS)[number]["clave"];

const dia = (f: string) => {
  const [a, m, d] = f.split("-").map(Number) as [number, number, number];
  return Date.UTC(a, m - 1, d);
};

/** Días de atraso de una factura: 0 o menos si aún no vence. */
export function diasDeAtraso(
  f: { fecha: string; dias_credito: number },
  hoy: string,
): number {
  const vence = fechaVencimiento(f.fecha, f.dias_credito);
  return Math.round((dia(hoy) - dia(vence)) / 86_400_000);
}

export function tramoDe(atraso: number): Tramo {
  if (atraso <= 0) return "por_vencer";
  if (atraso <= 30) return "d1_30";
  if (atraso <= 60) return "d31_60";
  if (atraso <= 90) return "d61_90";
  return "mas_90";
}

export type FacturaPorCobrar = {
  razon_social_id: string;
  moneda: string;
  fecha: string;
  dias_credito: number;
  saldo: number;
};

export type RenglonAntiguedad = {
  razon_social_id: string;
  moneda: string;
  facturas: number;
  /** Saldo por tramo y total. */
  tramos: Record<Tramo, number>;
  vencido: number;
  total: number;
};

const centavos = (n: number) => Math.round(n * 100);

/**
 * Antigüedad de saldos: un renglón por razón social y moneda (no se suman
 * monedas distintas), con el saldo repartido por días de atraso. Se suma en
 * centavos para no arrastrar decimales.
 */
export function antiguedadDeSaldos(
  facturas: FacturaPorCobrar[],
  hoy: string,
): RenglonAntiguedad[] {
  const porClave = new Map<
    string,
    { r: FacturaPorCobrar; n: number; c: Record<Tramo, number> }
  >();
  for (const f of facturas) {
    if (f.saldo <= 0) continue;
    const clave = `${f.razon_social_id}|${f.moneda}`;
    let g = porClave.get(clave);
    if (!g) {
      g = {
        r: f,
        n: 0,
        c: { por_vencer: 0, d1_30: 0, d31_60: 0, d61_90: 0, mas_90: 0 },
      };
      porClave.set(clave, g);
    }
    g.n += 1;
    g.c[tramoDe(diasDeAtraso(f, hoy))] += centavos(f.saldo);
  }
  return [...porClave.values()].map(({ r, n, c }) => {
    const total = TRAMOS.reduce((s, t) => s + c[t.clave], 0);
    const tramos = Object.fromEntries(
      TRAMOS.map((t) => [t.clave, c[t.clave] / 100]),
    ) as Record<Tramo, number>;
    return {
      razon_social_id: r.razon_social_id,
      moneda: r.moneda,
      facturas: n,
      tramos,
      vencido: (total - c.por_vencer) / 100,
      total: total / 100,
    };
  });
}

/** Totales del reporte por moneda, en el orden de los renglones. */
export function totalesPorMoneda(
  renglones: RenglonAntiguedad[],
): { moneda: string; vencido: number; total: number }[] {
  const m = new Map<string, { vencido: number; total: number }>();
  for (const r of renglones) {
    const t = m.get(r.moneda) ?? { vencido: 0, total: 0 };
    t.vencido += centavos(r.vencido);
    t.total += centavos(r.total);
    m.set(r.moneda, t);
  }
  return [...m.entries()].map(([moneda, t]) => ({
    moneda,
    vencido: t.vencido / 100,
    total: t.total / 100,
  }));
}

/** "Vence en 12 días", "Vence hoy" o "Vencida hace 3 días". */
export function textoAtraso(atraso: number): string {
  if (atraso === 0) return "Vence hoy";
  const n = Math.abs(atraso);
  const dias = `${n} ${n === 1 ? "día" : "días"}`;
  return atraso < 0 ? `Vence en ${dias}` : `Vencida hace ${dias}`;
}

// Portal de proveedores ---------------------------------------------------------

export const ESTADOS_PORTAL: Opcion[] = [
  { value: "pendiente_subir", label: "Pendiente de subir" },
  { value: "subida", label: "Subida" },
  { value: "aprobada", label: "Aprobada" },
  { value: "programada", label: "Programada para pago" },
  { value: "pagada", label: "Pagada" },
];

export const nombreEstadoPortal = (estado: string | null | undefined) =>
  ESTADOS_PORTAL.find((e) => e.value === estado)?.label ?? "Pendiente de subir";

export const CAMPOS_PORTAL: Campo[] = [
  {
    name: "estado",
    label: "Estado en el portal",
    tipo: "opciones",
    opciones: ESTADOS_PORTAL,
    valorInicial: "pendiente_subir",
  },
  {
    name: "fecha_subida",
    label: "Fecha en que se subió",
    tipo: "fecha",
    opcional: true,
  },
  {
    name: "fecha_aprobacion",
    label: "Fecha de aprobación",
    tipo: "fecha",
    opcional: true,
  },
  {
    name: "fecha_pago_programado",
    label: "Fecha de pago programada",
    tipo: "fecha",
    opcional: true,
    ayuda: "El día en que el portal dice que pagará.",
  },
  {
    name: "notas",
    label: "Notas",
    tipo: "textoLargo",
    opcional: true,
    ayuda: "Folio de recepción, motivo de rechazo, con quién se habló…",
  },
];

export const validarPortal: Validador = (v) => {
  if (v.estado !== "pendiente_subir" && !v.fecha_subida)
    return {
      campo: "fecha_subida",
      mensaje: "Indica qué día se subió al portal.",
    };
  if (
    v.fecha_subida &&
    v.fecha_aprobacion &&
    String(v.fecha_aprobacion) < String(v.fecha_subida)
  )
    return {
      campo: "fecha_aprobacion",
      mensaje: "No puede aprobarse antes de subirse.",
    };
  return null;
};

// Órdenes de compra -------------------------------------------------------------

export type SaldoOrden = {
  monto: number | null;
  facturado: number;
  saldo: number | null;
};

/** ¿Ya se facturó más de lo que ampara la orden? */
export const ordenExcedida = (s: SaldoOrden) => s.saldo !== null && s.saldo < 0;
