import { notFound } from "next/navigation";
import { z } from "zod";
import { FileUploader } from "@/components/forms/file-uploader";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerDocumento, tiposDeDocumento } from "@/lib/acceso/data";
import { camposDocumento } from "@/lib/acceso/documentos";
import { requirePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { directorioTecnicos } from "@/lib/ordenes/data";
import {
  prepararArchivoDocumento,
  registrarArchivoDocumento,
} from "../actions";
import { DocumentoForm } from "../documento-form";

export default async function DocumentoAccesoPage({
  params,
}: PageProps<"/documentos-acceso/[registro]">) {
  await requirePermiso("documentos_acceso.editar");
  const { registro } = await params;
  const esNuevo = registro === "nuevo";
  const doc = esNuevo
    ? null
    : z.uuid().safeParse(registro).success
      ? await obtenerDocumento(registro)
      : null;
  if (!esNuevo && !doc) notFound();

  const [tipos, { asignables, nombres }] = await Promise.all([
    tiposDeDocumento(),
    directorioTecnicos(),
  ]);
  const opcionesTipo = tipos.map((t) => ({
    value: t.id,
    label: `${t.nombre} (${t.aplica_a === "empresa" ? "de MOT" : "por persona"})`,
  }));
  const personas = [...asignables];
  // Se conservan en la lista el tipo y la persona guardados aunque ya no estén activos.
  if (doc && !opcionesTipo.some((t) => t.value === doc.tipo_id))
    opcionesTipo.push({
      value: doc.tipo_id,
      label: doc.tipos_documento_acceso?.nombre ?? "—",
    });
  if (doc?.perfil_id && !personas.some((p) => p.value === doc.perfil_id))
    personas.push({
      value: doc.perfil_id,
      label: nombres.get(doc.perfil_id) ?? "—",
    });

  const campos = camposDocumento(opcionesTipo, personas);
  const titulo = esNuevo ? "Registrar documento" : "Documento de acceso";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader
        title={titulo}
        description={
          doc
            ? `${doc.tipos_documento_acceso?.nombre ?? ""} · ${doc.perfil_id ? (nombres.get(doc.perfil_id) ?? "—") : "MOT"}`
            : "De MOT o de una persona que entra a planta."
        }
      />
      {doc ? (
        <Card>
          <CardHeader>
            <CardTitle>Archivo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {doc.archivo_ruta ? (
              <a
                href={`/archivos/documento-acceso/${doc.id}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium break-words text-primary underline-offset-4 hover:underline"
              >
                {doc.archivo_nombre}
              </a>
            ) : (
              <FileUploader
                texto="Subir archivo"
                ayuda="PDF o imagen, hasta 10 MB. Una vez subido no se reemplaza: si el documento se renueva, registra uno nuevo."
                preparar={prepararArchivoDocumento.bind(null, doc.id)}
                registrar={registrarArchivoDocumento.bind(null, doc.id)}
              />
            )}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent>
          <DocumentoForm
            documentoId={doc?.id ?? null}
            campos={campos}
            valores={valoresIniciales(
              campos,
              doc
                ? {
                    tipo_id: doc.tipo_id,
                    perfil_id: doc.perfil_id,
                    fecha_vencimiento: doc.fecha_vencimiento,
                    notas: doc.notas,
                  }
                : undefined,
            )}
            tiposDePersona={tipos
              .filter((t) => t.aplica_a === "persona")
              .map((t) => t.id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
