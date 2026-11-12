import type { Campo, Opcion, Validador } from "@/lib/forms/campos";

/** Flota de Robox (DISENO §4.3). */

export const ESTADOS_ROBOX: Opcion[] = [
  { value: "disponible", label: "Disponible" },
  { value: "en_cliente", label: "En cliente" },
  { value: "en_taller", label: "En taller" },
  { value: "baja", label: "Baja" },
];

export const etiquetaEstado = (estado: string) =>
  ESTADOS_ROBOX.find((e) => e.value === estado)?.label ?? estado;

export const CAMPOS_ROBOX: Campo[] = [
  {
    name: "numero_serie",
    label: "Número de serie",
    tipo: "texto",
    max: 60,
    ayuda:
      "Como aparece en la pantalla de información del equipo. Ejemplo: 545592.",
  },
  { name: "modelo", label: "Modelo", tipo: "texto", opcional: true, max: 60 },
  {
    name: "version_programa",
    label: "Versión de programa",
    tipo: "texto",
    opcional: true,
    max: 30,
  },
  {
    name: "sim",
    label: "SIM",
    tipo: "texto",
    opcional: true,
    max: 40,
    ayuda: "Número de la tarjeta SIM del equipo, si lo tiene.",
  },
  {
    name: "estado",
    label: "Estado",
    tipo: "opciones",
    opciones: ESTADOS_ROBOX,
    valorInicial: "disponible",
  },
  { name: "fecha_alta", label: "Fecha de alta", tipo: "fecha", opcional: true },
  { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
];

// Asignaciones, carrusel y movimientos (DISENO §4.3) ---------------------------

export const MOVIDO_POR: Opcion[] = [
  { value: "mot", label: "MOT" },
  { value: "cliente", label: "El cliente" },
];

/** Al asignar se elige el contrato; al editar se puede poner la fecha de término. */
export function camposAsignacion(
  contratos: Opcion[],
  hoy: string,
  esEdicion: boolean,
): Campo[] {
  const campos: Campo[] = [
    {
      name: "contrato_id",
      label: "Contrato",
      tipo: "referencia",
      opciones: contratos,
      soloAlCrear: true,
      ayuda:
        contratos.length === 0
          ? "No hay contratos en borrador o vigentes. Primero crea el contrato."
          : "El Robox queda en la planta de ese contrato.",
    },
    {
      name: "fecha_inicio",
      label: "Desde",
      tipo: "fecha",
      valorInicial: hoy,
    },
  ];
  if (esEdicion) {
    campos.push({
      name: "fecha_fin",
      label: "Hasta",
      tipo: "fecha",
      opcional: true,
      ayuda:
        "Déjalo vacío mientras siga con el cliente. Al poner la fecha, el Robox queda disponible.",
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

export const validarAsignacion: Validador = (v) =>
  v.fecha_inicio && v.fecha_fin && v.fecha_fin < v.fecha_inicio
    ? { campo: "fecha_fin", mensaje: "No puede ser anterior al inicio." }
    : null;

export function camposCarrusel(equipos: Opcion[]): Campo[] {
  return [
    {
      name: "equipo_cliente_id",
      label: "Equipo o tanque del cliente",
      tipo: "referencia",
      opciones: equipos,
      soloAlCrear: true,
      ayuda:
        equipos.length === 0
          ? "No quedan equipos de esta planta por agregar. Se dan de alta en la ficha del cliente."
          : undefined,
    },
    {
      name: "orden",
      label: "Orden en la rotación",
      tipo: "entero",
      opcional: true,
    },
    {
      name: "id_caso",
      label: "ID de caso",
      tipo: "texto",
      opcional: true,
      max: 40,
      ayuda:
        "El que va en el formato de servicio y en el frasco. Ejemplo: RAS1-08.",
    },
  ];
}

export function camposMovimiento(tanques: Opcion[], hoy: string): Campo[] {
  return [
    { name: "fecha", label: "Fecha", tipo: "fecha", valorInicial: hoy },
    {
      name: "equipo_destino_id",
      label: "Se movió a",
      tipo: "referencia",
      opciones: tanques,
      ayuda: "Los tanques del carrusel, menos el actual.",
    },
    {
      name: "movido_por",
      label: "Lo movió",
      tipo: "opciones",
      opciones: MOVIDO_POR,
      valorInicial: "mot",
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}

/** "11B116 (REP4)". */
export const nombreEquipo = (e: {
  identificador: string;
  alias: string | null;
}) => `${e.identificador}${e.alias ? ` (${e.alias})` : ""}`;

/**
 * Revisa un movimiento nuevo contra el estado actual. Devuelve el motivo por
 * el que no procede, o null si está bien.
 */
export function problemaMovimiento(m: {
  fecha: string;
  destinoId: string;
  tanqueActualId: string | null;
  carruselIds: string[];
  inicioAsignacion: string;
  ultimoMovimiento: string | null;
}): string | null {
  if (!m.carruselIds.includes(m.destinoId))
    return "Ese tanque no está en el carrusel de este Robox.";
  if (m.destinoId === m.tanqueActualId)
    return "El Robox ya está en ese tanque.";
  if (m.fecha < m.inicioAsignacion)
    return "La fecha no puede ser anterior al inicio de la asignación.";
  if (m.ultimoMovimiento && m.fecha < m.ultimoMovimiento)
    return "La fecha no puede ser anterior al último movimiento.";
  return null;
}
