import { ESTADOS_ROBOX } from "@/lib/flota/campos";
import { inicioDeMes } from "./tablero";

/**
 * Tablero de dirección, parte de operación: flota, visitas y laboratorio, y
 * el periodo que elige quien consulta. Sin base ni navegador.
 */

/** Periodos que ofrece el tablero, en meses (contando el mes en curso). */
export const PERIODOS = [3, 6, 12] as const;
export const PERIODO_POR_DEFECTO = 12;

/** Lee `?meses=` de la dirección; lo que no sea un periodo válido cae en el de por defecto. */
export function periodoDe(valor: string | string[] | undefined): number {
  const n = Number(typeof valor === "string" ? valor : "");
  return (PERIODOS as readonly number[]).includes(n) ? n : PERIODO_POR_DEFECTO;
}

export type DatosDeOperacion = {
  /** Estado de cada Robox vigente. */
  robox: string[];
  ordenes: {
    tipo: string;
    estado: string;
    fecha_programada: string;
    fecha_real: string | null;
  }[];
  muestras: { estado: string; fecha_muestreo: string }[];
  informes: {
    estado: string;
    validado_at: string | null;
    publicado_at: string | null;
  }[];
};

export type ResumenOperacion = {
  robox: {
    /** Todos menos los dados de baja. */
    enServicio: number;
    enCliente: number;
    /** En cliente entre los que están en servicio, en porcentaje entero; null sin flota. */
    utilizacion: number | null;
    porEstado: { estado: string; label: string; cantidad: number }[];
  };
  visitas: {
    cerradas: number;
    porMes: { mes: string; cantidad: number }[];
    enCurso: number;
    programadas: number;
    atrasadas: number;
  };
  laboratorio: {
    muestras: number;
    enProceso: number;
    informesValidados: number;
    sinPublicar: number;
  };
};

/**
 * `meses` son los primeros días de los meses del periodo, del más antiguo al
 * actual; `hoy`, el día de hoy en México.
 */
export function resumenOperacion(
  d: DatosDeOperacion,
  meses: string[],
  hoy: string,
): ResumenOperacion {
  const desde = meses[0] ?? inicioDeMes(hoy);
  const enServicio = d.robox.filter((e) => e !== "baja").length;
  const enCliente = d.robox.filter((e) => e === "en_cliente").length;

  const visitas = d.ordenes.filter((o) => o.tipo === "visita");
  // Una visita cerrada cuenta en el mes en que se hizo.
  const cerradas = visitas.filter(
    (o) =>
      o.estado === "cerrada" && (o.fecha_real ?? o.fecha_programada) >= desde,
  );
  const programadas = visitas.filter((o) => o.estado === "programada");

  const desdeInstante = new Date(`${desde}T00:00:00-06:00`).getTime();
  const validados = d.informes.filter((i) => i.estado === "validado");

  return {
    robox: {
      enServicio,
      enCliente,
      utilizacion:
        enServicio === 0 ? null : Math.round((enCliente / enServicio) * 100),
      porEstado: ESTADOS_ROBOX.map((e) => ({
        estado: e.value,
        label: e.label,
        cantidad: d.robox.filter((r) => r === e.value).length,
      })),
    },
    visitas: {
      cerradas: cerradas.length,
      porMes: meses.map((mes) => ({
        mes,
        cantidad: cerradas.filter(
          (o) => inicioDeMes(o.fecha_real ?? o.fecha_programada) === mes,
        ).length,
      })),
      enCurso: visitas.filter((o) => o.estado === "en_curso").length,
      programadas: programadas.filter((o) => o.fecha_programada >= hoy).length,
      atrasadas: programadas.filter((o) => o.fecha_programada < hoy).length,
    },
    laboratorio: {
      muestras: d.muestras.filter(
        (m) => m.estado !== "cancelada" && m.fecha_muestreo >= desde,
      ).length,
      enProceso: d.muestras.filter(
        (m) => m.estado !== "cancelada" && m.estado !== "concluida",
      ).length,
      informesValidados: validados.filter(
        (i) =>
          i.validado_at !== null &&
          new Date(i.validado_at).getTime() >= desdeInstante,
      ).length,
      sinPublicar: validados.filter((i) => i.publicado_at === null).length,
    },
  };
}
