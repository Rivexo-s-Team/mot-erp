import { formatDia, formatFecha, formatImporte } from "@/lib/format";
import { describirCantidad } from "./campos";

/**
 * Lo que aparece en el PDF que recibe el cliente, con el formato de la
 * cotización tipo de MOT. Se arma aparte del dibujo del documento para poder
 * probarlo y para dejar claro qué NO sale: notas internas, precio de referencia
 * del aceite, costo del contenedor, su fuente y el comprobante.
 */

export type EntradaPdf = {
  oportunidad: {
    cliente: string;
    planta: string | null;
    /** Dirección de la planta en una línea, si hay planta y está capturada. */
    direccion: string | null;
  };
  cotizacion: {
    folio: string;
    version: number;
    estado: string;
    moneda: string;
    vigencia: string | null;
    valor_total_contrato: number | null;
    litros_estimados: number | null;
    condiciones: string | null;
    condiciones_pago: string | null;
    numero_requisicion: string | null;
    created_at: string;
    contactos: {
      nombre: string;
      telefono_celular: string | null;
      telefono_oficina: string | null;
      correo: string | null;
    } | null;
    lineas: {
      concepto: string;
      cantidad: number;
      unidad: string;
      precio_unitario: number;
      recurrente: boolean;
      importe: number | null;
      numero_parte_cliente: string | null;
      equipos_cliente: { identificador: string; alias: string | null } | null;
    }[];
    totales: { total_unico: number; total_recurrente: number };
  };
};

type Renglon = { etiqueta: string; valor: string };

export type DatosPdf = {
  folio: string;
  esBorrador: boolean;
  /** Bloque izquierdo: a quién va dirigida. */
  cliente: Renglon[];
  /** Bloque derecho: datos de la cotización. */
  encabezado: Renglon[];
  partidas: {
    descripcion: string;
    detalle: string | null;
    numeroParte: string;
    cantidad: string;
    precioUnitario: string;
    subtotal: string;
  }[];
  totales: Renglon[];
  datosAdicionales: Renglon[];
  notas: string[];
  nombreArchivo: string;
};

const guion = (v: string | null | undefined) =>
  v && v.trim() !== "" ? v.trim() : "—";

export function datosParaPdf({
  oportunidad,
  cotizacion: c,
}: EntradaPdf): DatosPdf {
  const importe = (n: number) => formatImporte(n, c.moneda);
  const contacto = c.contactos;
  const folio = c.version > 1 ? `${c.folio} (versión ${c.version})` : c.folio;

  const hayUnico = c.lineas.some((l) => !l.recurrente);
  const hayRecurrente = c.lineas.some((l) => l.recurrente);
  const totales: Renglon[] = [];
  if (hayUnico && hayRecurrente) {
    totales.push({
      etiqueta: "TOTAL (una sola vez)",
      valor: importe(c.totales.total_unico),
    });
    totales.push({
      etiqueta: "TOTAL recurrente (por periodo)",
      valor: importe(c.totales.total_recurrente),
    });
  } else if (hayRecurrente) {
    totales.push({
      etiqueta: "TOTAL (por periodo)",
      valor: importe(c.totales.total_recurrente),
    });
  } else {
    totales.push({ etiqueta: "TOTAL", valor: importe(c.totales.total_unico) });
  }

  const datosAdicionales: Renglon[] = [];
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

  // Las dos primeras notas van siempre; después, las que capture el vendedor (una por renglón).
  const notasDelVendedor = (c.condiciones ?? "")
    .split(/\r?\n/)
    .map((n) => n.trim().replace(/^\d+\s*[.)-]+\s*-?\s*/, ""))
    .filter((n) => n !== "");

  return {
    folio,
    esBorrador: c.estado === "borrador",
    cliente: [
      {
        etiqueta: "Empresa",
        valor: oportunidad.planta
          ? `${oportunidad.cliente} · ${oportunidad.planta}`
          : oportunidad.cliente,
      },
      { etiqueta: "Dirección", valor: guion(oportunidad.direccion) },
      { etiqueta: "Atención", valor: guion(contacto?.nombre) },
      {
        etiqueta: "Teléfono",
        valor: guion(contacto?.telefono_celular ?? contacto?.telefono_oficina),
      },
      { etiqueta: "Email", valor: guion(contacto?.correo) },
    ],
    encabezado: [
      { etiqueta: "Cotización No.", valor: folio },
      { etiqueta: "Fecha", valor: formatFecha(c.created_at) },
      { etiqueta: "No. Requisición", valor: guion(c.numero_requisicion) },
      { etiqueta: "Servicio", valor: "Planta Cliente" },
      {
        etiqueta: "Válido hasta",
        valor: c.vigencia ? formatDia(c.vigencia) : "—",
      },
      { etiqueta: "Condiciones de pago", valor: guion(c.condiciones_pago) },
    ],
    partidas: c.lineas.map((l) => ({
      descripcion: l.concepto,
      detalle:
        [
          l.equipos_cliente
            ? `Equipo ${l.equipos_cliente.identificador}${l.equipos_cliente.alias ? ` (${l.equipos_cliente.alias})` : ""}`
            : null,
          l.recurrente ? "Recurrente" : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      numeroParte: guion(l.numero_parte_cliente),
      cantidad: describirCantidad(l.cantidad, l.unidad),
      precioUnitario: importe(l.precio_unitario),
      subtotal: importe(l.importe ?? 0),
    })),
    totales,
    datosAdicionales,
    notas: [
      "Precios más IVA.",
      `Tipo de moneda ${c.moneda}.`,
      ...notasDelVendedor,
    ],
    nombreArchivo: nombreArchivo(c.folio, c.version),
  };
}

/** "Cotizacion-CMOT-2026-050.pdf" (o "…-v2.pdf"): sin espacios ni caracteres que rompan la descarga. */
export function nombreArchivo(folio: string, version: number): string {
  const limpio = folio
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `Cotizacion-${limpio || "MOT"}${version > 1 ? `-v${version}` : ""}.pdf`;
}
