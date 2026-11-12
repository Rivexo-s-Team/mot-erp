import type { Campo, Opcion, Validador } from "@/lib/forms/campos";

/** Pipeline comercial (DISENO §4.2). El orden de ETAPAS es el del proceso de venta. */

export const ETAPAS: Opcion[] = [
  { value: "primer_contacto", label: "Primer contacto" },
  { value: "presentacion", label: "Presentación" },
  { value: "visita", label: "Visita" },
  { value: "muestra", label: "Muestra" },
  { value: "resultados_laboratorio", label: "Resultados de laboratorio" },
  { value: "cotizacion", label: "Cotización" },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "ganada", label: "Ganada" },
  { value: "perdida", label: "Perdida" },
];

export const ETAPAS_CERRADAS = ["ganada", "perdida"];
export const ETAPAS_ABIERTAS = ETAPAS.filter(
  (e) => !ETAPAS_CERRADAS.includes(e.value),
);

export const TIPOS: Opcion[] = [
  { value: "nuevo", label: "Cliente nuevo" },
  { value: "ampliacion", label: "Ampliación (cliente actual)" },
];

export const ORIGENES: Opcion[] = [
  { value: "prospeccion", label: "Prospección" },
  { value: "referencia", label: "Referencia" },
  { value: "recomendacion", label: "Recomendación" },
  { value: "cliente_anterior", label: "Cliente anterior" },
];

export const TIPOS_ACTIVIDAD: Opcion[] = [
  { value: "llamada", label: "Llamada" },
  { value: "correo", label: "Correo" },
  { value: "presentacion_email", label: "Presentación por correo" },
  { value: "presentacion_presencial", label: "Presentación presencial" },
  { value: "visita", label: "Visita" },
  { value: "seguimiento", label: "Seguimiento" },
];

export const etiqueta = (opciones: Opcion[], valor: string | null) =>
  opciones.find((o) => o.value === valor)?.label ?? valor ?? "—";

export function camposOportunidad(
  plantas: Opcion[],
  responsables: Opcion[],
  canales: Opcion[],
): Campo[] {
  return [
    {
      name: "nombre",
      label: "Nombre de la oportunidad",
      tipo: "texto",
      ayuda:
        "Una frase que la identifique. Ejemplo: Renta de Robox para prensas.",
    },
    {
      name: "planta_id",
      label: "Planta",
      tipo: "referencia",
      opcional: true,
      opciones: plantas,
      ayuda:
        "Déjalo en Ninguno si todavía no se sabe o es para toda la cuenta.",
    },
    { name: "tipo", label: "Tipo", tipo: "opciones", opciones: TIPOS },
    { name: "origen", label: "Origen", tipo: "opciones", opciones: ORIGENES },
    {
      name: "responsable_id",
      label: "Responsable interno",
      tipo: "referencia",
      opciones: responsables,
      ayuda: "Quien le da seguimiento dentro de MOT.",
    },
    {
      name: "canal_venta_id",
      label: "Canal de venta (vendedor externo)",
      tipo: "referencia",
      opcional: true,
      opciones: canales,
      ayuda:
        "Solo si la venta la trajo un vendedor externo. Se dan de alta en Catálogos.",
    },
    {
      name: "volumen_estimado_l",
      label: "Volumen estimado (litros)",
      tipo: "numero",
      opcional: true,
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}

export function camposActividad(
  responsables: Opcion[],
  hoy: string,
  yo: string,
): Campo[] {
  return [
    {
      name: "tipo",
      label: "Tipo de actividad",
      tipo: "opciones",
      opciones: TIPOS_ACTIVIDAD,
    },
    { name: "fecha", label: "Fecha", tipo: "fecha", valorInicial: hoy },
    {
      name: "responsable_id",
      label: "Quién la hizo",
      tipo: "referencia",
      opciones: responsables,
      valorInicial: yo,
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}

/** Cambio de etapa. `motivos` es la lista de motivos de pérdida vigentes. */
export function camposEtapa(motivos: Opcion[]): Campo[] {
  return [
    { name: "etapa", label: "Etapa", tipo: "opciones", opciones: ETAPAS },
    {
      name: "motivo_perdida_id",
      label: "Motivo de la pérdida",
      tipo: "referencia",
      opcional: true,
      opciones: motivos,
      ayuda: "Solo si la marcas como perdida. La lista se edita en Catálogos.",
    },
    {
      name: "motivo_perdida",
      label: "Detalle de la pérdida",
      tipo: "textoLargo",
      opcional: true,
    },
  ];
}

export const validarEtapa: Validador = (v) =>
  v.etapa === "perdida" &&
  String(v.motivo_perdida_id ?? "") === "" &&
  String(v.motivo_perdida ?? "").trim() === ""
    ? {
        campo: "motivo_perdida_id",
        mensaje: "Elige por qué se perdió, o escríbelo en el detalle.",
      }
    : null;
