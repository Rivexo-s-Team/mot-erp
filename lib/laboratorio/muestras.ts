import type { Campo, Opcion, Validador } from "@/lib/forms/campos";

/** Muestras de aceite (DISENO §4.5). Los resultados y el informe llegan en los pasos siguientes. */

export const TIPOS_MUESTRA: Opcion[] = [
  { value: "virgen", label: "Virgen (línea base)" },
  { value: "usado", label: "Usado (arranque de filtración)" },
  { value: "antes_filtrar", label: "Antes de filtrar" },
  { value: "filtrado", label: "Filtrado" },
];

export const TOMADA_POR: Opcion[] = [
  { value: "mot", label: "MOT" },
  { value: "cliente", label: "El cliente" },
];

// PENDIENTE(P5): falta que el laboratorio diga qué incluye cada nivel.
export const NIVELES_ANALISIS: Opcion[] = [
  { value: "basico", label: "Básico" },
  { value: "basico_mpc", label: "Básico + MPC" },
  { value: "extendido", label: "Extendido" },
  { value: "premium", label: "Premium" },
];

export const ESTADOS_MUESTRA: Opcion[] = [
  { value: "pendiente", label: "Por recibir" },
  { value: "recibida", label: "Recibida" },
  { value: "en_analisis", label: "En análisis" },
  { value: "concluida", label: "Concluida" },
  { value: "cancelada", label: "Cancelada" },
];

/** Estados en los que el laboratorio todavía tiene trabajo con la muestra. */
export const ESTADOS_EN_PROCESO = ["pendiente", "recibida", "en_analisis"];

export const etiqueta = (opciones: Opcion[], valor: string | null) =>
  opciones.find((o) => o.value === valor)?.label ?? valor ?? "—";

export const PATRON_ID_MUESTRA = "^\\d{6}-\\d{3,}$";

export type OpcionesMuestra = {
  equipos: Opcion[];
  ordenes: Opcion[];
  oportunidades: Opcion[];
};

export function camposMuestra(
  esEdicion: boolean,
  o: OpcionesMuestra,
  hoy: string,
): Campo[] {
  const campos: Campo[] = [
    {
      name: "equipo_cliente_id",
      label: "Equipo o tanque del cliente",
      tipo: "referencia",
      opciones: o.equipos,
    },
    {
      name: "tipo",
      label: "Tipo de muestra",
      tipo: "opciones",
      opciones: TIPOS_MUESTRA,
    },
    {
      name: "tomada_por",
      label: "La tomó",
      tipo: "opciones",
      opciones: TOMADA_POR,
      valorInicial: "mot",
    },
    {
      name: "fecha_muestreo",
      label: "Fecha de muestreo",
      tipo: "fecha",
      valorInicial: hoy,
    },
    {
      name: "fecha_recepcion",
      label: "Fecha de recepción en el laboratorio",
      tipo: "fecha",
      opcional: true,
      ayuda: esEdicion
        ? undefined
        : "Si aún no llega al laboratorio, déjala vacía: queda por recibir.",
    },
    {
      name: "id_muestra",
      label: "ID de muestra",
      tipo: "texto",
      opcional: !esEdicion,
      patron: PATRON_ID_MUESTRA,
      mensajePatron: "Usa el formato AAMMDD-NNN, por ejemplo 260617-092.",
      max: 20,
      ayuda: esEdicion
        ? undefined
        : "Déjalo vacío y el sistema lo genera: fecha de muestreo más el consecutivo del año.",
    },
    {
      name: "nivel_analisis",
      label: "Nivel de análisis",
      tipo: "opciones",
      opcional: true,
      opciones: NIVELES_ANALISIS,
    },
    {
      name: "id_caso",
      label: "ID de caso",
      tipo: "texto",
      opcional: true,
      max: 40,
      ayuda: "Como aparece en el frasco, por ejemplo RAS1-08.",
    },
    {
      name: "punto_muestreo",
      label: "Punto de muestreo",
      tipo: "texto",
      opcional: true,
      ayuda: "De dónde se tomó: tanque, línea de retorno, salida del Robox…",
    },
    {
      name: "condicion_operacion",
      label: "Condición de operación de la máquina",
      tipo: "texto",
      opcional: true,
      ayuda: "Por ejemplo: en operación, detenida, recién arrancada.",
    },
    {
      name: "orden_id",
      label: "Orden de servicio en la que se tomó",
      tipo: "referencia",
      opcional: true,
      opciones: o.ordenes,
    },
    {
      name: "oportunidad_id",
      label: "Oportunidad comercial",
      tipo: "referencia",
      opcional: true,
      opciones: o.oportunidades,
      ayuda: "Si la muestra es para un prospecto o una ampliación.",
    },
  ];
  if (esEdicion) {
    campos.push({
      name: "estado",
      label: "Estado",
      tipo: "opciones",
      opciones: ESTADOS_MUESTRA,
    });
  }
  campos.push({
    name: "notas",
    label: "Anotaciones",
    tipo: "textoLargo",
    opcional: true,
  });
  // Solo se ofrece ligar la muestra si hay con qué (o si el rol puede verlo).
  return campos.filter(
    (c) =>
      (c.name !== "orden_id" || o.ordenes.length > 0) &&
      (c.name !== "oportunidad_id" || o.oportunidades.length > 0),
  );
}

export const validarMuestra: Validador = (v) => {
  const muestreo = String(v.fecha_muestreo ?? "");
  const recepcion = String(v.fecha_recepcion ?? "");
  if (recepcion && muestreo && recepcion < muestreo)
    return {
      campo: "fecha_recepcion",
      mensaje: "No puede recibirse antes de tomarse.",
    };
  if (
    !recepcion &&
    typeof v.estado === "string" &&
    ["recibida", "en_analisis", "concluida"].includes(v.estado)
  )
    return {
      campo: "fecha_recepcion",
      mensaje: "Para ese estado falta la fecha de recepción.",
    };
  return null;
};

/** Estado con el que nace una muestra: recibida si ya trae fecha de recepción. */
export const estadoInicial = (fechaRecepcion: string | null) =>
  fechaRecepcion ? "recibida" : "pendiente";

/** Qué se puede hacer con una muestra según su estado. */
export function accionesMuestra(estado: string) {
  return {
    recibir: estado === "pendiente",
    // Una muestra cancelada no lleva resultados.
    capturar: estado !== "cancelada",
  };
}
