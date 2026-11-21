import type { Campo, Opcion } from "@/lib/forms/campos";
import { FORMAS_PAGO } from "./credito";

/**
 * Pagos y su aplicación a facturas (DISENO §4.6). Los importes viajan como
 * texto hasta la base, que es la que suma: aquí no se hace aritmética con
 * decimales. Sin base ni navegador.
 */

/** Formas en que se recibe un pago: las del SAT menos "99 Por definir". */
export const FORMAS_DE_PAGO_RECIBIDO: Opcion[] = FORMAS_PAGO.filter(
  (f) => f.value !== "99",
);

export type EstadoCobro = "pendiente" | "parcial" | "pagada";

export const ESTADOS_COBRO: Record<EstadoCobro, string> = {
  pendiente: "Por cobrar",
  parcial: "Pago parcial",
  pagada: "Pagada",
};

/** Cómo va el cobro de una factura emitida, según su saldo. */
export function estadoCobro(s: { pagado: number; saldo: number }): EstadoCobro {
  if (s.saldo <= 0) return "pagada";
  return s.pagado > 0 ? "parcial" : "pendiente";
}

const IMPORTE = /^\d+(\.\d{1,2})?$/;

/** Un importe bien escrito y mayor que cero ("116", "116.5", "116.50"). */
export const esImporte = (v: string) => IMPORTE.test(v) && Number(v) > 0;

/** Prefijo de los campos "monto a aplicar" del formulario, uno por factura. */
export const CAMPO_APLICAR = "aplicar_";

export type DatosPago = {
  razon_social: string;
  fecha: string;
  monto: string;
  moneda: string;
  tipo_cambio: string;
  forma_pago: string;
  referencia: string;
  notas: string;
  /** Cuenta de MOT donde cayó el pago; vacío si no se indicó. */
  cuenta_bancaria_id: string;
};

export type PagoLeido =
  | {
      ok: true;
      datos: DatosPago;
      aplicaciones: { factura_id: string; monto: string }[];
    }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lee y revisa el formulario de un pago nuevo: sus datos y cuánto se aplica a
 * cada factura (los campos vacíos no aplican nada). Que lo aplicado no pase
 * del pago ni del saldo de cada factura lo revisa la base.
 */
export function leerPago(campos: Record<string, string>): PagoLeido {
  const texto = (k: string) => (campos[k] ?? "").trim();
  const datos: DatosPago = {
    razon_social: texto("razon_social"),
    fecha: texto("fecha"),
    monto: texto("monto"),
    moneda: texto("moneda"),
    tipo_cambio: texto("tipo_cambio"),
    forma_pago: texto("forma_pago"),
    referencia: texto("referencia").slice(0, 100),
    notas: texto("notas").slice(0, 2000),
    cuenta_bancaria_id: texto("cuenta_bancaria_id"),
  };
  if (!UUID.test(datos.razon_social))
    return { ok: false, error: "Falta la razón social que paga." };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) ||
    Number.isNaN(Date.parse(datos.fecha))
  )
    return { ok: false, error: "Elige la fecha del pago." };
  if (!esImporte(datos.monto))
    return {
      ok: false,
      error: "Escribe el monto recibido, por ejemplo 696.00.",
    };
  if (!/^[A-Z]{3}$/.test(datos.moneda))
    return { ok: false, error: "Falta la moneda del pago." };
  if (!FORMAS_DE_PAGO_RECIBIDO.some((f) => f.value === datos.forma_pago))
    return { ok: false, error: "Elige la forma de pago." };
  if (datos.cuenta_bancaria_id !== "" && !UUID.test(datos.cuenta_bancaria_id))
    return { ok: false, error: "Elige la cuenta bancaria de la lista." };
  if (datos.tipo_cambio !== "") {
    if (datos.moneda === "MXN")
      return { ok: false, error: "Un pago en pesos no lleva tipo de cambio." };
    if (
      !/^\d+(\.\d+)?$/.test(datos.tipo_cambio) ||
      Number(datos.tipo_cambio) <= 0
    )
      return { ok: false, error: "Revisa el tipo de cambio." };
  }

  const aplicaciones: { factura_id: string; monto: string }[] = [];
  for (const [campo, valor] of Object.entries(campos)) {
    if (!campo.startsWith(CAMPO_APLICAR)) continue;
    const factura_id = campo.slice(CAMPO_APLICAR.length);
    const monto = valor.trim();
    if (monto === "") continue;
    if (!UUID.test(factura_id) || !esImporte(monto))
      return {
        ok: false,
        error: "Revisa los montos a aplicar: números con hasta dos decimales.",
      };
    aplicaciones.push({ factura_id, monto });
  }
  return { ok: true, datos, aplicaciones };
}

/** Complemento de pago (REP) timbrado fuera del sistema. */
export const CAMPOS_COMPLEMENTO: Campo[] = [
  {
    name: "rep_folio",
    label: "Folio del complemento de pago",
    tipo: "texto",
    max: 40,
  },
  {
    name: "rep_uuid",
    label: "Folio fiscal (UUID) del complemento",
    tipo: "texto",
    max: 36,
    patron:
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    mensajePatron:
      "Son 36 caracteres con guiones, como aparece en el complemento timbrado.",
  },
];

/**
 * ¿El pago necesita complemento de pago? Sí cuando se aplicó a alguna
 * factura PPD (pago en parcialidades o diferido); con PUE no se emite.
 */
export const requiereComplemento = (metodosDeFacturas: (string | null)[]) =>
  metodosDeFacturas.includes("PPD");

/** Forma "30" del SAT: el pago no es dinero nuevo, sale de un anticipo. */
export const FORMA_ANTICIPO = "30";

/** Nombre de la forma de pago, incluida la aplicación de anticipos. */
export const nombreFormaPago = (clave: string | null) =>
  clave === FORMA_ANTICIPO
    ? "30 · Aplicación de anticipos"
    : (FORMAS_PAGO.find((f) => f.value === clave)?.label ?? clave ?? "—");

/** "BBVA dólares · terminación 4321", para listas y fichas. */
export const nombreCuentaBancaria = (c: {
  nombre: string;
  terminacion: string | null;
}) => (c.terminacion ? `${c.nombre} · terminación ${c.terminacion}` : c.nombre);
