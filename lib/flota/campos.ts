import type { Campo, Opcion } from "@/lib/forms/campos";

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
