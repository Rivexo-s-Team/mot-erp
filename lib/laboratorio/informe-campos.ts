import type { Campo, Opcion } from "@/lib/forms/campos";
import { formatDia } from "@/lib/format";
import type { MuestraDeInforme } from "./informe";
import { etiqueta, TIPOS_MUESTRA } from "./muestras";

/** Formulario del informe de laboratorio. */

const PREFIJO_MUESTRA = "muestra_";

/** Nombre de la casilla de una muestra en el formulario de edición. */
export const casillaDeMuestra = (id: string) => `${PREFIJO_MUESTRA}${id}`;

/** Las muestras marcadas en el formulario. */
export const muestrasMarcadas = (valores: Record<string, unknown>) =>
  Object.entries(valores)
    .filter(([k, v]) => k.startsWith(PREFIJO_MUESTRA) && v === true)
    .map(([k]) => k.slice(PREFIJO_MUESTRA.length));

/** Campos que se guardan en la tabla (sin las casillas de muestras). */
export const esCampoDeInforme = (c: Campo) =>
  !c.name.startsWith(PREFIJO_MUESTRA);

const camposBase = (hoy: string, esAlta: boolean): Campo[] => [
  {
    name: "folio",
    label: "Folio",
    tipo: "texto",
    max: 60,
    opcional: esAlta,
    // PENDIENTE(P1): falta la regla del folio; se propone el de la última muestra.
    ayuda: esAlta
      ? "Déjalo vacío y se propone con el consecutivo de la última muestra (FOLAB-26-092). Lo puedes cambiar después."
      : undefined,
  },
  {
    name: "fecha_emision",
    label: "Fecha de emisión",
    tipo: "fecha",
    valorInicial: hoy,
  },
  {
    name: "observaciones",
    label: "Observaciones",
    tipo: "textoLargo",
    opcional: true,
    max: 4000,
    ayuda: "Lo que el laboratorio concluye y recomienda. Sale en el informe.",
  },
];

/** Alta: de qué equipo es. Sus muestras con resultados se incluyen solas. */
export function camposInformeNuevo(equipos: Opcion[], hoy: string): Campo[] {
  return [
    {
      name: "equipo_cliente_id",
      label: "Equipo o tanque del cliente",
      tipo: "referencia",
      opciones: equipos,
      ayuda:
        "Se incluyen todas sus muestras con resultados; después puedes quitar alguna.",
    },
    ...camposBase(hoy, true),
  ];
}

/** Edición: datos del informe y qué muestras del equipo incluye. */
export function camposInformeEdicion(
  muestras: MuestraDeInforme[],
  hoy: string,
): Campo[] {
  return [
    ...camposBase(hoy, false),
    ...muestras.map((m): Campo => ({
      name: casillaDeMuestra(m.id),
      label: `Incluir ${m.id_muestra} · ${etiqueta(TIPOS_MUESTRA, m.tipo)} · ${formatDia(m.fecha_muestreo)}${Object.keys(m.resultados).length === 0 ? " · sin resultados" : ""}`,
      tipo: "casilla",
    })),
  ];
}
