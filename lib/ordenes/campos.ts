import type { Campo, Opcion, Validador } from "@/lib/forms/campos";

/** Órdenes de servicio (DISENO §4.4): la versión digital del formato "Servicio RecondOil Box". */

export const TIPOS_ORDEN: Opcion[] = [
  { value: "visita", label: "Visita de servicio" },
  { value: "taller", label: "Taller" },
];

export const ESTADOS_ORDEN: Opcion[] = [
  { value: "programada", label: "Programada" },
  { value: "en_curso", label: "En curso" },
  { value: "cerrada", label: "Cerrada" },
  { value: "cancelada", label: "Cancelada" },
];

/** Estados en los que la orden sigue viva para el técnico. */
export const ESTADOS_ABIERTOS = ["programada", "en_curso"];

export const etiqueta = (opciones: Opcion[], valor: string | null) =>
  opciones.find((o) => o.value === valor)?.label ?? valor ?? "—";

export type OpcionesOrden = {
  plantas: Opcion[];
  contratos: Opcion[];
  equipos: Opcion[];
  robox: Opcion[];
  tecnicos: Opcion[];
};

export const SIN_OPCIONES: OpcionesOrden = {
  plantas: [],
  contratos: [],
  equipos: [],
  robox: [],
  tecnicos: [],
};

/**
 * Encabezado de la orden. Una visita es a la planta de un cliente; en taller
 * solo se indica el Robox. `eligeTecnico` es falso para el técnico que crea
 * su propia orden: el servidor lo pone a él como responsable.
 */
export function camposOrden(
  tipo: "visita" | "taller",
  o: OpcionesOrden,
  hoy: string,
  eligeTecnico: boolean,
  yo = "",
): Campo[] {
  const campos: Campo[] = [];
  if (tipo === "visita") {
    campos.push(
      {
        name: "planta_id",
        label: "Planta",
        tipo: "referencia",
        opciones: o.plantas,
      },
      {
        name: "contrato_id",
        label: "Contrato",
        tipo: "referencia",
        opcional: true,
        opciones: o.contratos,
        ayuda:
          "Déjalo en Ninguno si la visita no es de un contrato (presentación, levantamiento).",
      },
      {
        name: "equipo_cliente_id",
        label: "Equipo o tanque del cliente",
        tipo: "referencia",
        opcional: true,
        opciones: o.equipos,
        ayuda: "Debe ser de la planta elegida.",
      },
    );
  }
  campos.push({
    name: "robox_id",
    label: "Robox",
    tipo: "referencia",
    opcional: true,
    opciones: o.robox,
  });
  if (eligeTecnico) {
    campos.push({
      name: "tecnico_id",
      label: "Técnico responsable",
      tipo: "referencia",
      opciones: o.tecnicos,
      valorInicial: yo,
    });
  }
  campos.push(
    {
      name: "acompanante_id",
      label: "Acompañante",
      tipo: "referencia",
      opcional: true,
      opciones: o.tecnicos,
    },
    {
      name: "fecha_programada",
      label: "Fecha programada",
      tipo: "fecha",
      valorInicial: hoy,
      ayuda: "Con esta fecha y las iniciales del técnico se arma el folio.",
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  );
  return campos;
}

export const validarOrden: Validador = (v) =>
  v.acompanante_id && v.acompanante_id === v.tecnico_id
    ? {
        campo: "acompanante_id",
        mensaje: "El acompañante no puede ser el mismo técnico.",
      }
    : null;

/** Qué se puede hacer con una orden según su estado. */
export function accionesOrden(estado: string) {
  return {
    editar: estado === "programada" || estado === "en_curso",
    iniciar: estado === "programada",
    cancelar: estado === "programada" || estado === "en_curso",
    reactivar: estado === "cancelada",
  };
}
