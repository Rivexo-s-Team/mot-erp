import { formatFechaHora, sumarDias } from "@/lib/format";

/**
 * Bitácora de cambios: qué se muestra de cada renglón y cómo se leen los
 * filtros de la pantalla. Sin base ni navegador.
 */

/** Tablas que llevan bitácora, con el nombre que ve la gente. */
export const TABLAS: Record<string, string> = {
  aceites: "Aceites",
  cargos: "Cargos por facturar",
  condiciones_credito: "Condiciones de crédito",
  contrato_tarifas: "Tarifas de contrato",
  contratos: "Contratos",
  cotizacion_lineas: "Partidas de cotización",
  cotizaciones: "Cotizaciones",
  equipos_cliente_costos: "Costos de equipos del cliente",
  factura_conceptos: "Conceptos de factura",
  facturas: "Facturas",
  informes: "Informes de laboratorio",
  muestra_resultados: "Resultados de laboratorio",
  muestras: "Muestras",
  ordenes_compra: "Órdenes de compra",
  pago_aplicaciones: "Aplicaciones de pago",
  pagos: "Pagos",
  parametros_laboratorio: "Parámetros de laboratorio",
  parametros_negocio: "Parámetros de negocio",
  perfiles: "Usuarios",
  portal_proveedor: "Portal de proveedores",
  razones_sociales: "Razones sociales",
  rol_permisos: "Permisos de los roles",
  usuarios_portal: "Usuarios del portal",
};

export const nombreTabla = (tabla: string) => TABLAS[tabla] ?? tabla;

export const OPERACIONES: Record<string, string> = {
  INSERT: "Alta",
  UPDATE: "Cambio",
  DELETE: "Baja",
};

export const nombreOperacion = (op: string) => OPERACIONES[op] ?? op;

/** Columnas que no dicen nada a quien lee la bitácora. */
const TECNICAS = new Set(["id", "created_at", "updated_at", "created_by"]);

type Datos = Record<string, unknown> | null;

export type Renglon = {
  operacion: string;
  datos_anteriores: Datos;
  datos_nuevos: Datos;
};

export type Cambio = { campo: string; antes: unknown; despues: unknown };

const igual = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Qué cambió en un renglón. En un cambio, solo los campos distintos; en un
 * alta o una baja, los campos con valor.
 */
export function cambiosDe(r: Renglon): Cambio[] {
  const antes = r.datos_anteriores ?? {};
  const despues = r.datos_nuevos ?? {};
  const campos = [
    ...new Set([...Object.keys(antes), ...Object.keys(despues)]),
  ].filter((c) => !TECNICAS.has(c));
  if (r.operacion === "UPDATE")
    return campos
      .filter((c) => !igual(antes[c], despues[c]))
      .map((c) => ({ campo: c, antes: antes[c], despues: despues[c] }));
  const datos = r.operacion === "DELETE" ? antes : despues;
  return campos
    .filter((c) => datos[c] !== null && datos[c] !== undefined)
    .map((c) => ({
      campo: c,
      antes: r.operacion === "DELETE" ? datos[c] : null,
      despues: r.operacion === "DELETE" ? null : datos[c],
    }));
}

const INSTANTE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Un valor de la bitácora como texto. `max` corta los muy largos (0 =
 * completo). Con `nombres`, el identificador de un usuario se lee como su
 * nombre; un instante se escribe como fecha y hora de México.
 */
export function textoValor(
  v: unknown,
  max = 80,
  nombres?: ReadonlyMap<string, string>,
): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "string") {
    const nombre = nombres?.get(v);
    if (nombre) return nombre;
    if (INSTANTE.test(v)) return formatFechaHora(v);
  }
  const texto = typeof v === "object" ? JSON.stringify(v) : String(v);
  return max > 0 && texto.length > max ? `${texto.slice(0, max)}…` : texto;
}

/** Los campos como se leen: "tipo_cambio" → "tipo cambio". */
export const nombreCampo = (campo: string) => campo.replaceAll("_", " ");

/** Resumen de un renglón para la lista: los primeros cambios y cuántos más hay. */
export function resumen(
  r: Renglon,
  nombres?: ReadonlyMap<string, string>,
  cuantos = 2,
): string {
  const cambios = cambiosDe(r);
  if (cambios.length === 0) return "Sin cambios visibles";
  const primeros = cambios
    .slice(0, cuantos)
    .map((c) =>
      r.operacion === "UPDATE"
        ? `${nombreCampo(c.campo)}: ${textoValor(c.antes, 30, nombres)} → ${textoValor(c.despues, 30, nombres)}`
        : `${nombreCampo(c.campo)}: ${textoValor(c.antes ?? c.despues, 30, nombres)}`,
    );
  const resto = cambios.length - primeros.length;
  return primeros.join(" · ") + (resto > 0 ? ` · y ${resto} más` : "");
}

// Filtros de la pantalla --------------------------------------------------------

export const POR_PAGINA = 50;

export type Filtros = {
  tabla: string;
  operacion: string;
  usuario: string;
  registro: string;
  desde: string;
  hasta: string;
  pagina: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const uno = (v: string | string[] | undefined) =>
  typeof v === "string" ? v.trim() : "";

/** Lee los filtros de la dirección; lo que no es válido se ignora. */
export function leerFiltros(
  p: Record<string, string | string[] | undefined>,
): Filtros {
  const pagina = Number(uno(p.pagina));
  return {
    tabla: uno(p.tabla) in TABLAS ? uno(p.tabla) : "",
    operacion: uno(p.operacion) in OPERACIONES ? uno(p.operacion) : "",
    usuario: UUID.test(uno(p.usuario)) ? uno(p.usuario) : "",
    registro: UUID.test(uno(p.registro)) ? uno(p.registro) : "",
    desde: DIA.test(uno(p.desde)) ? uno(p.desde) : "",
    hasta: DIA.test(uno(p.hasta)) ? uno(p.hasta) : "",
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  };
}

/** La dirección de la lista con esos filtros (sin los vacíos). */
export function direccion(f: Partial<Filtros>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (k === "pagina" ? Number(v) > 1 : v) q.set(k, String(v));
  }
  const texto = q.toString();
  return texto ? `/bitacora?${texto}` : "/bitacora";
}

/**
 * Instantes entre los que cae un rango de días en hora del centro de México
 * (UTC−6 todo el año): desde el inicio de `desde` hasta antes del día
 * siguiente a `hasta`.
 */
export function rangoDeFechas(f: Pick<Filtros, "desde" | "hasta">) {
  return {
    desde: f.desde ? `${f.desde}T00:00:00-06:00` : null,
    antesDe: f.hasta ? `${sumarDias(f.hasta, 1)}T00:00:00-06:00` : null,
  };
}
