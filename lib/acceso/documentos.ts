import type { Campo, Opcion, Validador } from "@/lib/forms/campos";
import { sumarDias } from "@/lib/format";

/**
 * Acceso a planta (DISENO §4.4): qué documentos de MOT y de quienes van a la
 * visita están vigentes, por vencer, vencidos o faltan. Sin base ni
 * navegador, para poder probarlo.
 */

export type EstadoDocumento = "vigente" | "por_vencer" | "vencido";

/** Un documento sin fecha de vencimiento no vence. */
export function estadoDocumento(
  vencimiento: string | null,
  hoy: string,
  avisoDias: number,
): EstadoDocumento {
  if (vencimiento === null) return "vigente";
  if (vencimiento < hoy) return "vencido";
  return vencimiento <= sumarDias(hoy, avisoDias) ? "por_vencer" : "vigente";
}

export type TipoDocumento = {
  id: string;
  nombre: string;
  aplica_a: string;
};

export type DocumentoAcceso = {
  id: string;
  tipo_id: string;
  perfil_id: string | null;
  fecha_vencimiento: string | null;
  tieneArchivo: boolean;
};

export type RenglonAcceso = {
  clave: string;
  documento: string;
  /** "MOT" o el nombre de la persona. */
  de: string;
  estado: EstadoDocumento | "falta";
  vencimiento: string | null;
  documentoId: string | null;
  tieneArchivo: boolean;
};

/** De varios documentos del mismo tipo y dueño, el que vence más tarde (o no vence). */
function elMasReciente(docs: DocumentoAcceso[]): DocumentoAcceso | undefined {
  return [...docs].sort((a, b) => {
    if (a.fecha_vencimiento === b.fecha_vencimiento) return 0;
    if (a.fecha_vencimiento === null) return -1;
    if (b.fecha_vencimiento === null) return 1;
    return b.fecha_vencimiento.localeCompare(a.fecha_vencimiento);
  })[0];
}

/**
 * Revisión documental: un renglón por cada documento de MOT y por cada
 * documento personal de quienes van (técnico y acompañante). Si alguien
 * renovó un documento, cuenta el más reciente.
 */
export function revisarAcceso(e: {
  tipos: TipoDocumento[];
  documentos: DocumentoAcceso[];
  personas: { id: string; nombre: string }[];
  hoy: string;
  avisoDias: number;
}): RenglonAcceso[] {
  const renglones: RenglonAcceso[] = [];
  for (const tipo of e.tipos) {
    const duenos =
      tipo.aplica_a === "empresa"
        ? [{ id: null as string | null, nombre: "MOT" }]
        : e.personas;
    for (const dueno of duenos) {
      const doc = elMasReciente(
        e.documentos.filter(
          (d) => d.tipo_id === tipo.id && d.perfil_id === dueno.id,
        ),
      );
      renglones.push({
        clave: `${tipo.id}:${dueno.id ?? "mot"}`,
        documento: tipo.nombre,
        de: dueno.nombre,
        estado: doc
          ? estadoDocumento(doc.fecha_vencimiento, e.hoy, e.avisoDias)
          : "falta",
        vencimiento: doc?.fecha_vencimiento ?? null,
        documentoId: doc?.id ?? null,
        tieneArchivo: doc?.tieneArchivo ?? false,
      });
    }
  }
  return renglones;
}

/** Hay algo que impide o pone en riesgo la entrada: falta o está vencido. */
export const impideEntrada = (r: RenglonAcceso) =>
  r.estado === "falta" || r.estado === "vencido";

export const ETIQUETA_ESTADO: Record<RenglonAcceso["estado"], string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  falta: "Falta",
};

export function camposDocumento(tipos: Opcion[], personas: Opcion[]): Campo[] {
  return [
    {
      name: "tipo_id",
      label: "Documento",
      tipo: "referencia",
      opciones: tipos,
      soloAlCrear: true,
    },
    {
      name: "perfil_id",
      label: "De quién es",
      tipo: "referencia",
      opcional: true,
      opciones: personas,
      soloAlCrear: true,
      ayuda:
        "Déjalo en Ninguno si el documento es de MOT (como el REPSE). Si es de una persona, elígela.",
    },
    {
      name: "fecha_vencimiento",
      label: "Vence el",
      tipo: "fecha",
      opcional: true,
      ayuda: "Déjalo vacío si no vence.",
    },
    { name: "notas", label: "Notas", tipo: "textoLargo", opcional: true },
  ];
}

/** Un documento personal necesita persona; uno de MOT no la lleva. */
export function validarDocumento(tiposDePersona: string[]): Validador {
  return (v) => {
    if (!v.tipo_id) return null;
    const esPersonal = tiposDePersona.includes(String(v.tipo_id));
    if (esPersonal && !v.perfil_id)
      return { campo: "perfil_id", mensaje: "Elige de quién es el documento." };
    if (!esPersonal && v.perfil_id)
      return {
        campo: "perfil_id",
        mensaje: "Ese documento es de MOT: déjalo en Ninguno.",
      };
    return null;
  };
}
