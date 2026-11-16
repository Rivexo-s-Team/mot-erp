import type { Campo, Opcion } from "@/lib/forms/campos";

/** Agenda de visitas (DISENO §4.4): órdenes programadas y visitas recurrentes por contrato. */

export const UNIDADES_FRECUENCIA: Opcion[] = [
  { value: "dias", label: "Días" },
  { value: "semanas", label: "Semanas" },
  { value: "meses", label: "Meses" },
];

/** "Cada mes", "Cada 2 semanas", "Cada 15 días". */
export function textoFrecuencia(cantidad: number, unidad: string): string {
  const uno: Record<string, string> = {
    dias: "día",
    semanas: "semana",
    meses: "mes",
  };
  const varios: Record<string, string> = {
    dias: "días",
    semanas: "semanas",
    meses: "meses",
  };
  return cantidad === 1
    ? `Cada ${uno[unidad] ?? unidad}`
    : `Cada ${cantidad} ${varios[unidad] ?? unidad}`;
}

/** Qué tan cerca está una fecha: ya pasó, es hoy o viene después. */
export function cercania(
  fecha: string,
  hoy: string,
): "atrasada" | "hoy" | "proxima" {
  return fecha < hoy ? "atrasada" : fecha === hoy ? "hoy" : "proxima";
}

/** Agrupa por día lo que tenga fecha, conservando el orden en que viene. */
export function agruparPorDia<T>(
  elementos: T[],
  fecha: (e: T) => string,
): { dia: string; elementos: T[] }[] {
  const grupos: { dia: string; elementos: T[] }[] = [];
  for (const e of elementos) {
    const dia = fecha(e);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.elementos.push(e);
    else grupos.push({ dia, elementos: [e] });
  }
  return grupos;
}

export function camposVisita(
  equipos: Opcion[],
  robox: Opcion[],
  tecnicos: Opcion[],
  hoy: string,
): Campo[] {
  return [
    {
      name: "cada_cantidad",
      label: "Se visita cada",
      tipo: "entero",
      valorInicial: "1",
    },
    {
      name: "cada_unidad",
      label: "Periodo",
      tipo: "opciones",
      opciones: UNIDADES_FRECUENCIA,
      valorInicial: "meses",
    },
    {
      name: "proxima_fecha",
      label: "Próxima visita",
      tipo: "fecha",
      valorInicial: hoy,
      ayuda: "Cada vez que se programe, esta fecha avanza sola un periodo.",
    },
    {
      name: "equipo_cliente_id",
      label: "Equipo o tanque del cliente",
      tipo: "referencia",
      opcional: true,
      opciones: equipos,
    },
    {
      name: "robox_id",
      label: "Robox",
      tipo: "referencia",
      opcional: true,
      opciones: robox,
    },
    {
      name: "tecnico_id",
      label: "Técnico que la atiende",
      tipo: "referencia",
      opcional: true,
      opciones: tecnicos,
      ayuda: "Déjalo en Ninguno para que quede a nombre de quien la programe.",
    },
    {
      name: "activa",
      label: "Activa (aparece en la agenda)",
      tipo: "casilla",
      inicial: true,
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}
