import type { Campo, Opcion } from "@/lib/forms/campos";

/** Campos de los formularios del expediente del cliente (DISENO §4.1). */

export const AREAS: Opcion[] = [
  { value: "compras", label: "Compras" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "operaciones", label: "Operaciones" },
  { value: "gerente_planta", label: "Gerente de planta" },
  { value: "cuentas_por_pagar", label: "Cuentas por pagar" },
  { value: "administracion", label: "Administración" },
  { value: "finanzas", label: "Finanzas" },
];

export const etiquetaArea = (area: string) =>
  AREAS.find((a) => a.value === area)?.label ?? area;

export const CAMPOS_CUENTA: Campo[] = [
  {
    name: "nombre",
    label: "Nombre del grupo o empresa",
    tipo: "texto",
    ayuda: "Como se le conoce comercialmente. Ejemplo: Rassini.",
  },
  {
    name: "tipo_industria",
    label: "Tipo de industria",
    tipo: "texto",
    opcional: true,
  },
  { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
];

export function camposPlanta(razonesSociales: Opcion[]): Campo[] {
  return [
    {
      name: "nombre",
      label: "Nombre de la planta o división",
      tipo: "texto",
      ayuda: "Ejemplo: BYPASA.",
    },
    { name: "calle", label: "Calle", tipo: "texto", opcional: true },
    {
      name: "numero_exterior",
      label: "Número exterior",
      tipo: "texto",
      opcional: true,
      max: 20,
    },
    {
      name: "numero_interior",
      label: "Número interior",
      tipo: "texto",
      opcional: true,
      max: 20,
    },
    { name: "colonia", label: "Colonia", tipo: "texto", opcional: true },
    { name: "municipio", label: "Municipio", tipo: "texto", opcional: true },
    { name: "estado", label: "Estado", tipo: "texto", opcional: true },
    {
      name: "codigo_postal",
      label: "Código postal",
      tipo: "texto",
      opcional: true,
      patron: "^[0-9]{5}$",
      mensajePatron: "El código postal tiene 5 dígitos.",
    },
    {
      name: "referencia",
      label: "Referencias para llegar",
      tipo: "textoLargo",
      opcional: true,
    },
    {
      name: "razon_social_id",
      label: "Razón social a la que se factura",
      tipo: "referencia",
      opcional: true,
      opciones: razonesSociales,
      ayuda:
        razonesSociales.length === 0
          ? "Esta cuenta aún no tiene razones sociales. Puedes agregarla después."
          : "La que se usa por defecto al facturar esta planta.",
    },
  ];
}

export const CAMPOS_RAZON_SOCIAL: Campo[] = [
  {
    name: "razon_social",
    label: "Razón social",
    tipo: "texto",
    ayuda: "Como aparece en la constancia de situación fiscal.",
  },
  {
    name: "rfc",
    label: "RFC",
    tipo: "texto",
    mayusculas: true,
    patron: "^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$",
    mensajePatron:
      "El RFC tiene 12 caracteres (empresa) o 13 (persona física).",
  },
  {
    name: "regimen_fiscal",
    label: "Régimen fiscal",
    tipo: "texto",
    opcional: true,
    patron: "^[0-9]{3}$",
    mensajePatron: "Es la clave de 3 dígitos del SAT.",
    ayuda: "Clave del SAT. Ejemplo: 601 (General de Ley Personas Morales).",
  },
  {
    name: "codigo_postal_fiscal",
    label: "Código postal fiscal",
    tipo: "texto",
    opcional: true,
    patron: "^[0-9]{5}$",
    mensajePatron: "El código postal tiene 5 dígitos.",
  },
  {
    name: "uso_cfdi",
    label: "Uso de CFDI",
    tipo: "texto",
    opcional: true,
    mayusculas: true,
    patron: "^[A-Z]{1,2}[0-9]{2}$",
    mensajePatron: "Es la clave del SAT, por ejemplo G03.",
    ayuda: "Clave del SAT. Ejemplo: G03 (Gastos en general).",
  },
  {
    name: "usa_portal_proveedores",
    label: "Pide subir las facturas a un portal de proveedores",
    tipo: "casilla",
  },
  { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
];

export function camposContacto(plantas: Opcion[]): Campo[] {
  return [
    { name: "nombre", label: "Nombre completo", tipo: "texto" },
    { name: "area", label: "Área", tipo: "opciones", opciones: AREAS },
    { name: "puesto", label: "Puesto", tipo: "texto", opcional: true },
    {
      name: "planta_id",
      label: "Planta",
      tipo: "referencia",
      opcional: true,
      opciones: plantas,
      ayuda: "Déjalo en Ninguno si el contacto es de toda la cuenta.",
    },
    {
      name: "telefono_celular",
      label: "Celular",
      tipo: "telefono",
      opcional: true,
      max: 30,
    },
    {
      name: "telefono_oficina",
      label: "Teléfono de oficina",
      tipo: "telefono",
      opcional: true,
      max: 30,
    },
    { name: "correo", label: "Correo", tipo: "correo", opcional: true },
    { name: "recibe_facturas", label: "Recibe las facturas", tipo: "casilla" },
    {
      name: "recibe_informes",
      label: "Recibe los informes de laboratorio",
      tipo: "casilla",
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}

/** Dirección de una planta en una línea, con lo que haya. */
export function direccionPlanta(p: {
  calle: string | null;
  numero_exterior: string | null;
  numero_interior: string | null;
  colonia: string | null;
  municipio: string | null;
  estado: string | null;
  codigo_postal: string | null;
}): string {
  const calle = [
    p.calle,
    p.numero_exterior,
    p.numero_interior ? `int. ${p.numero_interior}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const cp = p.codigo_postal ? `C.P. ${p.codigo_postal}` : null;
  return [calle, p.colonia, p.municipio, p.estado, cp]
    .filter(Boolean)
    .join(", ");
}
