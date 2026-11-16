import "server-only";
import { hoyEnMexico } from "@/lib/format";
import { directorioTecnicos } from "@/lib/ordenes/data";
import { createClient } from "@/lib/supabase/server";
import {
  revisarAcceso,
  type DocumentoAcceso,
  type TipoDocumento,
} from "./documentos";

/** Lecturas de documentos de acceso. RLS decide qué ve cada rol. */

export async function tiposDeDocumento(): Promise<TipoDocumento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipos_documento_acceso")
    .select("id, nombre, aplica_a")
    .eq("activo", true)
    .order("orden")
    .order("nombre");
  if (error) throw new Error("No se pudieron cargar los tipos de documento.");
  return data;
}

export async function listarDocumentos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documentos_acceso")
    .select(
      "id, tipo_id, perfil_id, fecha_vencimiento, archivo_ruta, archivo_nombre, notas, tipos_documento_acceso (nombre, aplica_a)",
    )
    .is("deleted_at", null)
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
  if (error) throw new Error("No se pudieron cargar los documentos.");
  return data;
}

export type Documento = Awaited<ReturnType<typeof listarDocumentos>>[number];

export async function obtenerDocumento(id: string) {
  return (await listarDocumentos()).find((d) => d.id === id) ?? null;
}

/** Días de anticipación del aviso de vencimiento. Si no se puede leer, no se avisa antes. */
export async function avisoDias(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("documento_aviso_dias");
  if (error) throw new Error("No se pudo cargar el parámetro de documentos.");
  return data ?? 0;
}

const aRevision = (docs: Documento[]): DocumentoAcceso[] =>
  docs.map((d) => ({
    id: d.id,
    tipo_id: d.tipo_id,
    perfil_id: d.perfil_id,
    fecha_vencimiento: d.fecha_vencimiento,
    tieneArchivo: d.archivo_ruta !== null,
  }));

/** Estado de los documentos de MOT y de las personas indicadas (o de todos los técnicos). */
export async function revisionDeAcceso(personaIds?: string[]) {
  const [tipos, documentos, aviso, { nombres, asignables }] = await Promise.all(
    [tiposDeDocumento(), listarDocumentos(), avisoDias(), directorioTecnicos()],
  );
  const personas = personaIds
    ? personaIds.map((id) => ({ id, nombre: nombres.get(id) ?? "—" }))
    : asignables.map((a) => ({ id: a.value, nombre: a.label }));
  return revisarAcceso({
    tipos,
    documentos: aRevision(documentos),
    personas,
    hoy: hoyEnMexico(),
    avisoDias: aviso,
  });
}

/** Lo que la planta pide para entrar (de su ficha en Clientes). */
export async function requisitosDeAcceso(plantaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("requisitos_planta")
    .select("id, nombre, detalle")
    .eq("planta_id", plantaId)
    .eq("categoria", "acceso_planta")
    .is("deleted_at", null)
    .order("nombre");
  // Quien no ve clientes no ve los requisitos: se muestra sin ellos.
  if (error) return [];
  return data;
}
