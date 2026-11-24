/**
 * Un solo código de colores para los estados de todo el sistema:
 * exito (verde) = terminado o al corriente; aviso (ámbar) = pendiente de
 * atender; peligro (rojo) = vencido o crítico; activo (azul fuerte) = en
 * proceso ahora; info (azul claro) = previsto; neutro (gris) = borrador,
 * cancelado o sin efecto.
 */
export type Tono = "exito" | "aviso" | "peligro" | "activo" | "info" | "neutro";

export type TipoEstado =
  | "orden"
  | "factura"
  | "cobro"
  | "contrato"
  | "robox"
  | "muestra"
  | "informe"
  | "documento"
  | "condicion"
  | "cotizacion"
  | "cargo";

const TONOS: Record<TipoEstado, Record<string, Tono>> = {
  orden: {
    programada: "info",
    en_curso: "activo",
    cerrada: "exito",
    cancelada: "neutro",
  },
  factura: { borrador: "neutro", emitida: "info", cancelada: "neutro" },
  cobro: { pendiente: "aviso", parcial: "aviso", pagada: "exito" },
  contrato: {
    borrador: "neutro",
    vigente: "exito",
    terminado: "neutro",
    cancelado: "neutro",
  },
  robox: {
    disponible: "info",
    bloqueado: "aviso",
    en_cliente: "exito",
    en_taller: "aviso",
    baja: "neutro",
  },
  muestra: {
    pendiente: "aviso",
    recibida: "info",
    en_analisis: "activo",
    concluida: "exito",
    cancelada: "neutro",
  },
  informe: { borrador: "aviso", validado: "exito" },
  documento: {
    vigente: "exito",
    por_vencer: "aviso",
    vencido: "peligro",
    falta: "peligro",
  },
  condicion: { normal: "exito", precaucion: "aviso", critico: "peligro" },
  cotizacion: {
    borrador: "neutro",
    enviada: "info",
    aceptada: "exito",
    rechazada: "neutro",
  },
  cargo: { pendiente: "aviso", facturado: "exito", cancelado: "neutro" },
};

/** Tono de un estado; uno desconocido sale neutro. */
export const tonoDeEstado = (tipo: TipoEstado, estado: string): Tono =>
  TONOS[tipo][estado] ?? "neutro";

/** Variante de la etiqueta (components/ui/badge) que pinta cada tono. */
export const VARIANTE_DE_TONO = {
  exito: "exito",
  aviso: "aviso",
  peligro: "destructive",
  activo: "default",
  info: "secondary",
  neutro: "neutro",
} as const satisfies Record<Tono, string>;
