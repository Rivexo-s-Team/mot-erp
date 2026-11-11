import { formatDia, formatFecha, formatImporte } from "@/lib/format";
import { describirCantidad } from "./campos";

/**
 * Lo que aparece en el PDF que recibe el cliente. Se arma aparte del dibujo
 * del documento para poder probarlo y para dejar claro qué NO sale: notas
 * internas, precio de referencia del aceite, su fuente y el comprobante.
 */

export type EntradaPdf = {
  oportunidad: { nombre: string; cliente: string; planta: string | null };
  cotizacion: {
    version: number;
    estado: string;
    moneda: string;
    vigencia: string | null;
    valor_total_contrato: number | null;
    litros_estimados: number | null;
    condiciones: string | null;
    created_at: string;
    lineas: {
      concepto: string;
      cantidad: number;
      unidad: string;
      precio_unitario: number;
      recurrente: boolean;
      importe: number | null;
      equipos_cliente: { identificador: string; alias: string | null } | null;
    }[];
    totales: { total_unico: number; total_recurrente: number };
  };
};

export type DatosPdf = {
  titulo: string;
  esBorrador: boolean;
  cliente: string;
  planta: string | null;
  referencia: string;
  fecha: string;
  vigencia: string | null;
  partidas: {
    concepto: string;
    equipo: string | null;
    cantidad: string;
    precioUnitario: string;
    importe: string;
    tipo: string;
  }[];
  totales: { etiqueta: string; valor: string }[];
  datosAdicionales: { etiqueta: string; valor: string }[];
  condiciones: string | null;
  notaImportes: string;
  nombreArchivo: string;
};

export function datosParaPdf({
  oportunidad,
  cotizacion: c,
}: EntradaPdf): DatosPdf {
  const importe = (n: number) => formatImporte(n, c.moneda);

  const totales: DatosPdf["totales"] = [];
  const hayUnico = c.lineas.some((l) => !l.recurrente);
  const hayRecurrente = c.lineas.some((l) => l.recurrente);
  if (hayUnico)
    totales.push({
      etiqueta: "Total (una sola vez)",
      valor: importe(c.totales.total_unico),
    });
  if (hayRecurrente) {
    totales.push({
      etiqueta: "Total recurrente (por periodo)",
      valor: importe(c.totales.total_recurrente),
    });
  }

  const datosAdicionales: DatosPdf["datosAdicionales"] = [];
  if (c.valor_total_contrato !== null) {
    datosAdicionales.push({
      etiqueta: "Valor total del contrato",
      valor: importe(c.valor_total_contrato),
    });
  }
  if (c.litros_estimados !== null) {
    datosAdicionales.push({
      etiqueta: "Litros estimados",
      valor: `${c.litros_estimados} L`,
    });
  }

  return {
    titulo: `Cotización · versión ${c.version}`,
    esBorrador: c.estado !== "enviada",
    cliente: oportunidad.cliente,
    planta: oportunidad.planta,
    referencia: oportunidad.nombre,
    fecha: formatFecha(c.created_at),
    vigencia: c.vigencia ? formatDia(c.vigencia) : null,
    partidas: c.lineas.map((l) => ({
      concepto: l.concepto,
      equipo: l.equipos_cliente
        ? `${l.equipos_cliente.identificador}${l.equipos_cliente.alias ? ` (${l.equipos_cliente.alias})` : ""}`
        : null,
      cantidad: describirCantidad(l.cantidad, l.unidad),
      precioUnitario: importe(l.precio_unitario),
      importe: importe(l.importe ?? 0),
      tipo: l.recurrente ? "Recurrente" : "Una sola vez",
    })),
    totales,
    datosAdicionales,
    condiciones: c.condiciones?.trim() || null,
    // PENDIENTE(P8): falta confirmar con MOT si sus precios llevan IVA incluido.
    notaImportes: `Importes en ${c.moneda}. No incluyen IVA.`,
    nombreArchivo: nombreArchivo(oportunidad.cliente, c.version),
  };
}

/** "Cotizacion-Rassini-v1.pdf": sin acentos ni caracteres que rompan la descarga. */
export function nombreArchivo(cliente: string, version: number): string {
  const limpio = cliente
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `Cotizacion-${limpio || "MOT"}-v${version}.pdf`;
}
