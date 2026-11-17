import { MONEDAS } from "@/lib/clientes/campos";
import type { Campo, Opcion } from "@/lib/forms/campos";

/** Cargos por facturar (DISENO §4.4 y §4.6). La factura llega en la Etapa 5. */

export const TIPOS_CARGO: Opcion[] = [
  { value: "renta", label: "Renta mensual" },
  { value: "evento_litro", label: "Evento por litro" },
  { value: "partes_mal_uso", label: "Partes dañadas por el cliente" },
  { value: "servicio", label: "Servicio" },
  { value: "laboratorio", label: "Laboratorio" },
  { value: "otro", label: "Otro" },
];

/**
 * Tipos que genera el sistema: la renta (al generar las rentas del mes) y el
 * cargo por litros (al cerrar la orden). A mano se capturan los demás.
 */
export const TIPOS_GENERADOS = ["renta", "evento_litro"];
export const TIPOS_CARGO_MANUAL = TIPOS_CARGO.filter(
  (t) => !TIPOS_GENERADOS.includes(t.value),
);

export const ESTADOS_CARGO: Opcion[] = [
  { value: "pendiente", label: "Pendiente de facturar" },
  { value: "facturado", label: "Facturado" },
  { value: "cancelado", label: "Cancelado" },
];

export const etiqueta = (opciones: Opcion[], valor: string | null) =>
  opciones.find((o) => o.value === valor)?.label ?? valor ?? "—";

/** A un cargo le falta cantidad o precio: todavía no se puede facturar. */
export const porCompletar = (c: {
  cantidad: number | null;
  precio_unitario: number | null;
}) => c.cantidad === null || c.precio_unitario === null;

export function camposCargo(esEdicion: boolean, tipoActual?: string): Campo[] {
  const campos: Campo[] = [
    {
      name: "tipo",
      label: "Tipo de cargo",
      tipo: "opciones",
      // Un cargo generado por el sistema conserva su tipo.
      opciones:
        tipoActual && TIPOS_GENERADOS.includes(tipoActual)
          ? TIPOS_CARGO
          : TIPOS_CARGO_MANUAL,
      soloAlCrear: true,
    },
    { name: "concepto", label: "Concepto", tipo: "texto", max: 300 },
    {
      name: "cantidad",
      label: "Cantidad",
      tipo: "numero",
      opcional: true,
      valorInicial: "1",
    },
    {
      name: "unidad",
      label: "Unidad",
      tipo: "texto",
      opcional: true,
      max: 30,
      ayuda: "Ejemplos: litro, pieza, servicio.",
    },
    {
      name: "precio_unitario",
      label: "Precio unitario sin IVA",
      tipo: "numero",
      opcional: true,
      ayuda:
        "Si aún no se sabe, déjalo vacío: el cargo queda por completar y no se factura.",
    },
    {
      name: "moneda",
      label: "Moneda",
      tipo: "opciones",
      opciones: MONEDAS,
      valorInicial: "USD",
    },
  ];
  if (esEdicion) {
    campos.push({
      name: "estado",
      label: "Estado",
      tipo: "opciones",
      // "Facturado" lo pondrá la facturación (Etapa 5), no una persona.
      opciones: ESTADOS_CARGO.filter((e) => e.value !== "facturado"),
    });
  }
  campos.push({
    name: "notas",
    label: "Notas",
    tipo: "textoLargo",
    opcional: true,
  });
  return campos;
}

/** Concepto que se propone para el cargo por partes dañadas de una orden. */
export function conceptoMalUso(folio: string, partes: string[]): string {
  const base = `Partes dañadas por el cliente, orden ${folio}`;
  return partes.length > 0 ? `${base}: ${partes.join(", ")}` : base;
}

/** Suma por moneda los importes de los cargos pendientes y completos. */
export function totalesPendientes(
  cargos: { estado: string; moneda: string; importe: number | null }[],
): { moneda: string; centavos: bigint }[] {
  const porMoneda = new Map<string, bigint>();
  for (const c of cargos) {
    if (c.estado !== "pendiente" || c.importe === null) continue;
    // En centavos enteros: no se suman decimales en JavaScript.
    const centavos = BigInt(Math.round(c.importe * 100));
    porMoneda.set(c.moneda, (porMoneda.get(c.moneda) ?? BigInt(0)) + centavos);
  }
  return [...porMoneda.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moneda, centavos]) => ({ moneda, centavos }));
}

/** "7500.00" a partir de centavos enteros. */
export function centavosATexto(centavos: bigint): string {
  const signo = centavos < BigInt(0) ? "-" : "";
  const abs = centavos < BigInt(0) ? -centavos : centavos;
  return `${signo}${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, "0")}`;
}
