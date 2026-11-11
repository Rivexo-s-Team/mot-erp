import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { obtenerCotizacion } from "@/lib/cotizaciones/data";
import { obtenerOportunidad } from "@/lib/pipeline/data";

/**
 * Carga la oportunidad y su cotización para las páginas de cotización.
 * Ver una cotización exige ver el pipeline y los precios.
 */
export async function cargarCotizacion(
  oportunidadId: string,
  cotizacionId: string,
) {
  const sesion = await requirePermiso("oportunidades.ver");
  if (!tienePermiso(sesion, "precios.ver"))
    redirect(`/oportunidades/${oportunidadId}`);
  if (
    !z.uuid().safeParse(oportunidadId).success ||
    !z.uuid().safeParse(cotizacionId).success
  ) {
    notFound();
  }
  const [oportunidad, cotizacion] = await Promise.all([
    obtenerOportunidad(oportunidadId),
    obtenerCotizacion(oportunidadId, cotizacionId),
  ]);
  if (!oportunidad || !cotizacion) notFound();

  const puedeEditar = tienePermiso(sesion, "oportunidades.editar");
  return {
    oportunidad,
    cotizacion,
    /** Solo en borrador y con permiso se puede cambiar. */
    editable: puedeEditar && cotizacion.estado === "borrador",
    puedeEditar,
  };
}
