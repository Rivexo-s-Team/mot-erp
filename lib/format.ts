export const ZONA_HORARIA = "America/Mexico_City";
const LOCALE = "es-MX";

type FechaEntrada = Date | string | number;

const fechaFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const horaFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partes(fmt: Intl.DateTimeFormat, fecha: FechaEntrada) {
  const mapa: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(fecha))) mapa[p.type] = p.value;
  return mapa;
}

/** dd/mm/aaaa en hora del centro de México. */
export function formatFecha(fecha: FechaEntrada): string {
  const p = partes(fechaFmt, fecha);
  return `${p.day}/${p.month}/${p.year}`;
}

/** Día del calendario guardado como "aaaa-mm-dd" (columna date) a dd/mm/aaaa, sin mover de zona. */
export function formatDia(dia: string): string {
  const [anio, mes, d] = dia.slice(0, 10).split("-");
  return `${d}/${mes}/${anio}`;
}

/** El día de hoy en México como "aaaa-mm-dd", para valores iniciales de fecha. */
export function hoyEnMexico(ahora: Date = new Date()): string {
  const p = partes(fechaFmt, ahora);
  return `${p.year}-${p.month}-${p.day}`;
}

/** dd/mm/aaaa hh:mm (24 h) en hora del centro de México. */
export function formatFechaHora(fecha: FechaEntrada): string {
  const h = partes(horaFmt, fecha);
  return `${formatFecha(fecha)} ${h.hour}:${h.minute}`;
}

/**
 * Importe con su moneda, p. ej. "1,234.50 USD". Recibe texto para no perder
 * precisión: Postgres entrega los `numeric` como cadena.
 */
export function formatImporte(
  importe: string | number,
  moneda: string,
): string {
  const numero = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(importe as Intl.StringNumericLiteral);
  return `${numero} ${moneda}`;
}
