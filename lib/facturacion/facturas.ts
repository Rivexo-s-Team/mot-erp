import type { Campo, Opcion, Validador } from "@/lib/forms/campos";
import { FORMAS_PAGO, METODOS_PAGO } from "./credito";

/**
 * Facturas (DISENO §4.6). Se arman con cargos y nacen como borrador; por
 * ahora se timbran fuera del sistema (D42). Sin base ni navegador.
 */

export const ESTADOS_FACTURA: Opcion[] = [
  { value: "borrador", label: "Borrador" },
  { value: "emitida", label: "Emitida" },
  { value: "cancelada", label: "Cancelada" },
];

export const etiqueta = (opciones: Opcion[], valor: string | null) =>
  opciones.find((o) => o.value === valor)?.label ?? valor ?? "—";

/** Datos del encabezado que se corrigen mientras la factura es borrador. */
export function camposFactura(moneda: string, hoy: string): Campo[] {
  const campos: Campo[] = [
    {
      name: "fecha",
      label: "Fecha de la factura",
      tipo: "fecha",
      valorInicial: hoy,
      ayuda: "Con esta fecha y los días de crédito se calcula el vencimiento.",
    },
  ];
  if (moneda !== "MXN") {
    campos.push({
      name: "tipo_cambio",
      label: `Tipo de cambio (pesos por ${moneda})`,
      tipo: "numero",
      opcional: true,
      // PENDIENTE(P8): falta el criterio del contador (qué día y qué fuente).
      ayuda:
        "El que se usará al timbrar. Puede quedar vacío mientras se define.",
    });
  }
  campos.push(
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
      name: "uso_cfdi",
      label: "Uso de CFDI",
      tipo: "texto",
      opcional: true,
      mayusculas: true,
      patron: "^[A-Z]{1,2}[0-9]{2}$",
      mensajePatron: "Es la clave del SAT, por ejemplo G03.",
    },
    {
      name: "dias_credito",
      label: "Días de crédito",
      tipo: "entero",
      ayuda:
        "Se toman de la razón social; cámbialos solo si esta factura es distinta.",
    },
    {
      name: "orden_compra",
      label: "Orden de compra del cliente",
      tipo: "texto",
      opcional: true,
      max: 60,
    },
    {
      name: "notas",
      label: "Notas internas",
      tipo: "textoLargo",
      opcional: true,
    },
  );
  return campos;
}

export const validarFactura: Validador = (v) => {
  if (Number(v.dias_credito) > 365)
    return { campo: "dias_credito", mensaje: "Máximo 365 días." };
  if (
    v.tipo_cambio !== undefined &&
    v.tipo_cambio !== "" &&
    Number(v.tipo_cambio) <= 0
  )
    return { campo: "tipo_cambio", mensaje: "Debe ser mayor que cero." };
  if (v.metodo_pago === "PPD" && v.forma_pago && v.forma_pago !== "99")
    return {
      campo: "forma_pago",
      mensaje: "Con PPD la forma de pago es 99 · Por definir.",
    };
  return null;
};

/** Claves del SAT de un concepto. */
export const CAMPOS_CONCEPTO: Campo[] = [
  { name: "descripcion", label: "Descripción", tipo: "texto", max: 300 },
  {
    name: "clave_prod_serv",
    label: "Clave de producto o servicio (SAT)",
    tipo: "texto",
    opcional: true,
    patron: "^[0-9]{8}$",
    mensajePatron: "Son 8 dígitos.",
    // PENDIENTE(P8): las claves que usa MOT las define su contador.
    ayuda: "La del catálogo del SAT que usa el contador de MOT.",
  },
  {
    name: "clave_unidad",
    label: "Clave de unidad (SAT)",
    tipo: "texto",
    opcional: true,
    mayusculas: true,
    patron: "^[A-Z0-9]{2,3}$",
    mensajePatron: "Son 2 o 3 letras o números, por ejemplo E48.",
  },
];

export type DatosParaTimbrar = {
  moneda: string;
  tipo_cambio: number | null;
  metodo_pago: string | null;
  forma_pago: string | null;
  uso_cfdi: string | null;
  orden_compra: string | null;
  razon: {
    regimen_fiscal: string | null;
    codigo_postal_fiscal: string | null;
  } | null;
  requiereOrdenCompra: boolean;
  conceptos: { clave_prod_serv: string | null; clave_unidad: string | null }[];
};

/** Lo que le falta a un borrador para poder timbrarse. Lista vacía = está completo. */
export function faltantesParaTimbrar(f: DatosParaTimbrar): string[] {
  const faltan: string[] = [];
  if (f.conceptos.length === 0) faltan.push("No tiene conceptos.");
  if (!f.razon?.regimen_fiscal)
    faltan.push("El régimen fiscal de la razón social.");
  if (!f.razon?.codigo_postal_fiscal)
    faltan.push("El código postal fiscal de la razón social.");
  if (!f.uso_cfdi) faltan.push("El uso de CFDI.");
  if (!f.metodo_pago) faltan.push("El método de pago.");
  if (!f.forma_pago) faltan.push("La forma de pago.");
  if (f.moneda !== "MXN" && f.tipo_cambio === null)
    faltan.push("El tipo de cambio.");
  if (f.requiereOrdenCompra && !f.orden_compra)
    faltan.push("La orden de compra: esta razón social la exige.");
  const sinClaves = f.conceptos.filter(
    (c) => !c.clave_prod_serv || !c.clave_unidad,
  ).length;
  if (sinClaves > 0)
    faltan.push(
      sinClaves === 1
        ? "Las claves del SAT de un concepto."
        : `Las claves del SAT de ${sinClaves} conceptos.`,
    );
  return faltan;
}

/**
 * Datos del timbre que se registran a mano (D42): los mismos que llenará el
 * PAC cuando el sistema timbre. También sirven para corregir el registro.
 */
export function camposEmision(moneda: string, hoy: string): Campo[] {
  const campos: Campo[] = [
    {
      name: "serie",
      label: "Serie",
      tipo: "texto",
      opcional: true,
      max: 25,
      mayusculas: true,
    },
    { name: "folio", label: "Folio", tipo: "texto", max: 40 },
    {
      name: "uuid_fiscal",
      label: "Folio fiscal (UUID)",
      tipo: "texto",
      max: 36,
      patron:
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
      mensajePatron:
        "Son 36 caracteres con guiones, como aparece en la factura timbrada.",
      ayuda:
        "Cópialo de la factura timbrada: no se puede repetir en otra factura.",
    },
    {
      name: "fecha",
      label: "Fecha de emisión",
      tipo: "fecha",
      valorInicial: hoy,
      ayuda: "Desde esta fecha corren los días de crédito.",
    },
  ];
  if (moneda !== "MXN")
    campos.push({
      name: "tipo_cambio",
      label: `Tipo de cambio (pesos por ${moneda})`,
      tipo: "numero",
      ayuda: "El que quedó en la factura timbrada.",
    });
  return campos;
}

export const validarEmision: Validador = (v) =>
  v.tipo_cambio !== undefined && Number(v.tipo_cambio) <= 0
    ? { campo: "tipo_cambio", mensaje: "Debe ser mayor que cero." }
    : null;

export const CAMPOS_CANCELACION: Campo[] = [
  {
    name: "motivo_cancelacion",
    label: "Motivo de la cancelación",
    tipo: "textoLargo",
    max: 500,
    ayuda:
      "Por ejemplo: se refacturó con otra orden de compra. Queda en la factura.",
  },
];

/** Serie y folio como se leen en la factura: "A 1024". */
export const folioFactura = (f: {
  serie: string | null;
  folio: string | null;
}) => [f.serie, f.folio].filter(Boolean).join(" ");

/** Qué se puede hacer con una factura según su estado. */
export function accionesFactura(estado: string) {
  return {
    editar: estado === "borrador",
    eliminar: estado === "borrador",
    /** Registrar que ya se timbró. */
    emitir: estado === "borrador",
    /** Corregir un dato mal capturado del registro. */
    corregirRegistro: estado === "emitida",
    subirArchivos: estado === "emitida",
    cancelar: estado === "emitida",
  };
}
