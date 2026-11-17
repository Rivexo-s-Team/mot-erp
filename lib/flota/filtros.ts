import type { Campo, Opcion, Validador } from "@/lib/forms/campos";

/**
 * Seguimiento de los filtros de cada Robox (DISENO §4.4). Un filtro se cambia
 * a los meses que diga el parámetro `filtro_cambio_meses`, o antes si la
 * pantalla del Robox ya marca que se le acabó la vida ("filter used" llegó a
 * "filter lifetime") o si el laboratorio lo recomienda en un informe validado. Sin base ni navegador, para poder probarlo.
 */

/** Suma meses a un día "aaaa-mm-dd". Si el día no existe en el mes destino, usa el último. */
export function sumarMeses(dia: string, meses: number): string {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  const destino = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(
    Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0),
  ).getUTCDate();
  destino.setUTCDate(Math.min(d, ultimo));
  return destino.toISOString().slice(0, 10);
}

/** Cuándo toca cambiar un filtro instalado y si ya se pasó la fecha. */
export function estadoFiltro(f: {
  fechaInstalacion: string;
  meses: number;
  hoy: string;
}): { vence: string; vencido: boolean } {
  const vence = sumarMeses(f.fechaInstalacion, f.meses);
  return { vence, vencido: f.hoy >= vence };
}

export type LecturaFiltro = {
  /** Día de la orden en que se tomó la lectura. */
  fecha: string;
  usados: number;
  vida: number | null;
};

/** La pantalla del Robox ya marca el filtro como agotado. */
export const lecturaAgotada = (l: LecturaFiltro | null | undefined) =>
  Boolean(l && l.vida !== null && l.vida > 0 && l.usados >= l.vida);

/**
 * ¿La lectura habla del filtro que está puesto? Si después de tomarla (o ese
 * mismo día) se instaló un filtro, la lectura es del filtro anterior y ya no cuenta.
 */
export function lecturaVigente(
  lectura: LecturaFiltro | null | undefined,
  filtros: { fechaInstalacion: string }[],
): lectura is LecturaFiltro {
  return Boolean(
    lectura && filtros.every((f) => f.fechaInstalacion < lectura.fecha),
  );
}

/** El laboratorio indicó, en un informe validado, que hay que cambiar el filtro. */
export type RecomendacionLaboratorio = {
  folio: string;
  equipo: string;
  /** Día en que se validó el informe. */
  fecha: string;
};

/**
 * ¿La recomendación sigue pendiente? Deja de contar cuando se instala un
 * filtro el día de la validación o después: ya se atendió.
 */
export function recomendacionVigente(
  r: RecomendacionLaboratorio,
  filtros: { fechaInstalacion: string }[],
): boolean {
  return filtros.every((f) => f.fechaInstalacion < r.fecha);
}

/**
 * Por qué hay que cambiar el filtro de un Robox. Lista vacía = todo en orden.
 * `meses` es nulo si no se pudo leer el parámetro: entonces solo cuenta la lectura.
 */
export function motivosDeCambio(e: {
  filtros: { nombre: string; fechaInstalacion: string }[];
  lectura: LecturaFiltro | null | undefined;
  meses: number | null;
  hoy: string;
  recomendaciones?: RecomendacionLaboratorio[];
}): string[] {
  const motivos: string[] = [];
  const meses = e.meses;
  if (meses !== null) {
    for (const f of e.filtros) {
      if (estadoFiltro({ ...f, meses, hoy: e.hoy }).vencido)
        motivos.push(`${f.nombre}: ya cumplió ${meses} meses instalado.`);
    }
  }
  if (lecturaVigente(e.lectura, e.filtros) && lecturaAgotada(e.lectura)) {
    motivos.push(
      `La pantalla del Robox marca ${e.lectura.usados} de ${e.lectura.vida} días de filtro.`,
    );
  }
  for (const r of e.recomendaciones ?? []) {
    if (recomendacionVigente(r, e.filtros))
      motivos.push(
        `El laboratorio recomienda cambiar el filtro (informe ${r.folio}, equipo ${r.equipo}).`,
      );
  }
  return motivos;
}

/** Al registrar se elige el filtro; al editar se puede poner la fecha de retiro. */
export function camposFiltro(
  filtros: Opcion[],
  hoy: string,
  esEdicion: boolean,
): Campo[] {
  const campos: Campo[] = [
    {
      name: "parte_id",
      label: "Filtro",
      tipo: "referencia",
      opciones: filtros,
      soloAlCrear: true,
      ayuda:
        filtros.length === 0
          ? "No hay filtros por registrar. En Catálogos, Partes y accesorios, se marca cuáles son filtros."
          : undefined,
    },
    {
      name: "fecha_instalacion",
      label: "Instalado el",
      tipo: "fecha",
      valorInicial: hoy,
    },
  ];
  if (esEdicion) {
    campos.push({
      name: "fecha_retiro",
      label: "Retirado el",
      tipo: "fecha",
      opcional: true,
      ayuda: "Déjalo vacío mientras siga instalado.",
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

export const validarFiltro: Validador = (v) =>
  v.fecha_instalacion && v.fecha_retiro && v.fecha_retiro < v.fecha_instalacion
    ? {
        campo: "fecha_retiro",
        mensaje: "No puede ser anterior a la instalación.",
      }
    : null;
