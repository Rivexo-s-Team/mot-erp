import {
  ETAPAS_ABIERTAS,
  seguimientoVencido,
  TIPOS,
} from "@/lib/pipeline/campos";

/**
 * Tablero de dirección, parte comercial: qué hay abierto y cómo cerró lo que
 * se decidió en el periodo. Sin base ni navegador.
 */

export type OportunidadDelTablero = {
  etapa: string;
  tipo: string;
  volumen_estimado_l: number | null;
  /** Instante en que se cerró (ganada, perdida o descartada). */
  fecha_cierre: string | null;
  siguiente_paso_fecha: string | null;
  /** Motivo del catálogo o, si no se eligió, el detalle escrito. */
  motivo: string | null;
};

export type ResumenComercial = {
  abiertas: number;
  porEtapa: { etapa: string; label: string; cantidad: number }[];
  porTipo: { tipo: string; label: string; cantidad: number }[];
  /** Litros estimados de las abiertas que lo tienen capturado. */
  litrosEstimados: number;
  seguimientosVencidos: number;
  sinSiguientePaso: number;
  ganadas: number;
  perdidas: number;
  descartadas: number;
  /** Ganadas entre ganadas más perdidas, en porcentaje entero; null si no hubo ninguna. */
  tasaDeCierre: number | null;
  motivos: { motivo: string; perdidas: number; descartadas: number }[];
};

const ABIERTAS = new Set(ETAPAS_ABIERTAS.map((e) => e.value));

/**
 * `desde` es el instante desde el que cuentan las cerradas (inicio del
 * periodo); `hoy`, el día de hoy en México, para los seguimientos.
 */
export function resumenComercial(
  oportunidades: OportunidadDelTablero[],
  desde: string,
  hoy: string,
): ResumenComercial {
  const abiertas = oportunidades.filter((o) => ABIERTAS.has(o.etapa));
  const inicio = new Date(desde).getTime();
  const cerradas = oportunidades.filter(
    (o) =>
      !ABIERTAS.has(o.etapa) &&
      o.fecha_cierre !== null &&
      new Date(o.fecha_cierre).getTime() >= inicio,
  );
  const cuenta = (etapa: string) =>
    cerradas.filter((o) => o.etapa === etapa).length;
  const ganadas = cuenta("ganada");
  const perdidas = cuenta("perdida");

  const motivos = new Map<string, { perdidas: number; descartadas: number }>();
  for (const o of cerradas) {
    if (o.etapa !== "perdida" && o.etapa !== "descartada") continue;
    const nombre = o.motivo?.trim() || "Sin motivo";
    const m = motivos.get(nombre) ?? { perdidas: 0, descartadas: 0 };
    if (o.etapa === "perdida") m.perdidas += 1;
    else m.descartadas += 1;
    motivos.set(nombre, m);
  }

  return {
    abiertas: abiertas.length,
    porEtapa: ETAPAS_ABIERTAS.map((e) => ({
      etapa: e.value,
      label: e.label,
      cantidad: abiertas.filter((o) => o.etapa === e.value).length,
    })),
    porTipo: TIPOS.map((t) => ({
      tipo: t.value,
      label: t.label,
      cantidad: abiertas.filter((o) => o.tipo === t.value).length,
    })),
    litrosEstimados: abiertas.reduce(
      (s, o) => s + (o.volumen_estimado_l ?? 0),
      0,
    ),
    seguimientosVencidos: oportunidades.filter((o) =>
      seguimientoVencido(o, hoy),
    ).length,
    sinSiguientePaso: abiertas.filter((o) => o.siguiente_paso_fecha === null)
      .length,
    ganadas,
    perdidas,
    descartadas: cuenta("descartada"),
    tasaDeCierre:
      ganadas + perdidas === 0
        ? null
        : Math.round((ganadas / (ganadas + perdidas)) * 100),
    motivos: [...motivos.entries()]
      .map(([motivo, m]) => ({ motivo, ...m }))
      .sort(
        (a, b) =>
          b.perdidas + b.descartadas - (a.perdidas + a.descartadas) ||
          a.motivo.localeCompare(b.motivo, "es"),
      ),
  };
}
