import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { hoyEnMexico } from "@/lib/format";
import {
  catalogosCaptura,
  directorioTecnicos,
  lugarOrden,
  obtenerCaptura,
  obtenerOrden,
} from "@/lib/ordenes/data";
import { CapturaForm } from "./captura-form";

export const metadata: Metadata = { title: "Captura de la visita" };

export default async function CapturaPage({
  params,
}: PageProps<"/campo/ordenes/[id]/captura">) {
  const sesion = await requirePermiso("ordenes.editar");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const o = await obtenerOrden(id);
  if (!o) notFound();

  // Se captura en una orden en curso, y solo quien participa en ella.
  const participa =
    tienePermiso(sesion, "ordenes.administrar") ||
    o.tecnico_id === sesion.id ||
    o.acompanante_id === sesion.id;
  if (!participa || o.estado !== "en_curso") redirect(`/campo/ordenes/${o.id}`);

  const [{ captura }, { nombres }] = await Promise.all([
    obtenerCaptura(o.id),
    directorioTecnicos(),
  ]);
  const catalogos = await catalogosCaptura(captura);
  // Se propone el nombre del técnico responsable para su firma.
  if (!captura.firmas.tecnico.nombre)
    captura.firmas.tecnico.nombre = nombres.get(o.tecnico_id) ?? "";

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Captura de la visita
        </h1>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {lugarOrden(o)} · Folio {o.folio}
        </p>
      </div>
      <CapturaForm
        ordenId={o.id}
        delSistema={captura}
        actividades={catalogos.actividades}
        fallas={catalogos.fallas}
        esVisita={o.tipo === "visita"}
        hoy={hoyEnMexico()}
        volverHref={`/campo/ordenes/${o.id}`}
      />
    </>
  );
}
