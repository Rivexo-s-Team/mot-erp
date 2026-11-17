import type { Campo, Opcion, Validador } from "@/lib/forms/campos";

/**
 * Condiciones de crédito por razón social (DISENO §4.6): cómo se le factura y
 * cobra. Sin base ni navegador.
 */

/** Método de pago del CFDI (catálogo del SAT). */
export const METODOS_PAGO: Opcion[] = [
  { value: "PUE", label: "PUE · Pago en una sola exhibición" },
  { value: "PPD", label: "PPD · Pago en parcialidades o diferido" },
];

/** Formas de pago más usadas del catálogo del SAT. */
export const FORMAS_PAGO: Opcion[] = [
  { value: "03", label: "03 · Transferencia electrónica" },
  { value: "02", label: "02 · Cheque nominativo" },
  { value: "01", label: "01 · Efectivo" },
  { value: "04", label: "04 · Tarjeta de crédito" },
  { value: "28", label: "28 · Tarjeta de débito" },
  { value: "99", label: "99 · Por definir" },
];

export const etiqueta = (opciones: Opcion[], valor: string | null) =>
  opciones.find((o) => o.value === valor)?.label ?? valor ?? "—";

export function camposCredito(contactos: Opcion[]): Campo[] {
  return [
    {
      name: "dias_credito",
      label: "Días de crédito",
      tipo: "entero",
      valorInicial: "0",
      ayuda:
        "Días naturales para pagar después de la fecha de la factura. 0 es de contado.",
    },
    {
      name: "requiere_orden_compra",
      label: "Exige orden de compra para recibir la factura",
      tipo: "casilla",
    },
    {
      name: "metodo_pago",
      label: "Método de pago",
      tipo: "opciones",
      opcional: true,
      opciones: METODOS_PAGO,
    },
    {
      name: "forma_pago",
      label: "Forma de pago",
      tipo: "opciones",
      opcional: true,
      opciones: FORMAS_PAGO,
      ayuda: "Con PPD el SAT pide 99 · Por definir.",
    },
    {
      name: "contacto_cxp_id",
      label: "Contacto de cuentas por pagar",
      tipo: "referencia",
      opcional: true,
      opciones: contactos,
      ayuda:
        contactos.length === 0
          ? "Este cliente aún no tiene contactos. Agrégalo en su ficha."
          : "A quién se le da seguimiento del pago.",
    },
    {
      name: "portal",
      label: "Portal de proveedores",
      tipo: "texto",
      opcional: true,
      ayuda:
        "Nombre o dirección del portal donde se suben las facturas, si usa uno.",
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}

export const validarCredito: Validador = (v) => {
  if (Number(v.dias_credito) > 365)
    return { campo: "dias_credito", mensaje: "Máximo 365 días." };
  // Regla del SAT.
  if (v.metodo_pago === "PPD" && v.forma_pago && v.forma_pago !== "99")
    return {
      campo: "forma_pago",
      mensaje: "Con PPD la forma de pago es 99 · Por definir.",
    };
  return null;
};

/** Las condiciones en una línea, para la ficha del cliente. */
export function resumenCredito(c: {
  dias_credito: number;
  requiere_orden_compra: boolean;
  metodo_pago: string | null;
}): string {
  return [
    c.dias_credito === 0 ? "De contado" : `${c.dias_credito} días de crédito`,
    c.requiere_orden_compra ? "exige orden de compra" : null,
    c.metodo_pago,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Día en que vence una factura: su fecha más los días de crédito. */
export function fechaVencimiento(fechaFactura: string, dias: number): string {
  const [a, m, d] = fechaFactura.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}
