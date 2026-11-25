import { diasDeAtraso } from "@/lib/facturacion/cobranza";

/**
 * Cómo ve el cliente sus facturas: qué debe, qué ya venció y cuánto suma.
 * Sin base ni navegador.
 */

export type FacturaDelCliente = {
  fecha: string;
  dias_credito: number;
  moneda: string;
  pagado: number;
  saldo: number;
};

export type EstadoDePago = "pagada" | "vencida" | "parcial" | "por_pagar";

/** Textos desde el lado del cliente ("por pagar", no "por cobrar"). */
export const ESTADOS_DE_PAGO: Record<
  EstadoDePago,
  { label: string; variante: "exito" | "destructive" | "aviso" }
> = {
  pagada: { label: "Pagada", variante: "exito" },
  vencida: { label: "Vencida", variante: "destructive" },
  parcial: { label: "Pago parcial", variante: "aviso" },
  por_pagar: { label: "Por pagar", variante: "aviso" },
};

/** Estado de una factura para el cliente. Vencida manda sobre pago parcial. */
export function estadoDePago(f: FacturaDelCliente, hoy: string): EstadoDePago {
  if (f.saldo <= 0) return "pagada";
  if (diasDeAtraso(f, hoy) > 0) return "vencida";
  return f.pagado > 0 ? "parcial" : "por_pagar";
}

export type SaldoDeMoneda = {
  moneda: string;
  facturas: number;
  saldo: number;
  vencido: number;
};

const centavos = (n: number) => Math.round(n * 100);

/** Lo que el cliente debe por moneda, y cuánto de eso ya venció. Suma en centavos. */
export function saldosPorMoneda(
  facturas: FacturaDelCliente[],
  hoy: string,
): SaldoDeMoneda[] {
  const porMoneda = new Map<
    string,
    { facturas: number; saldo: number; vencido: number }
  >();
  for (const f of facturas) {
    if (f.saldo <= 0) continue;
    const s = porMoneda.get(f.moneda) ?? { facturas: 0, saldo: 0, vencido: 0 };
    s.facturas += 1;
    s.saldo += centavos(f.saldo);
    if (diasDeAtraso(f, hoy) > 0) s.vencido += centavos(f.saldo);
    porMoneda.set(f.moneda, s);
  }
  return [...porMoneda.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moneda, s]) => ({
      moneda,
      facturas: s.facturas,
      saldo: s.saldo / 100,
      vencido: s.vencido / 100,
    }));
}
