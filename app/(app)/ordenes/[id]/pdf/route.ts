import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermiso } from "@/lib/auth/session";
import { direccionDePlanta } from "@/lib/cotizaciones/data";
import {
  catalogosCaptura,
  directorioTecnicos,
  equipoParaPdf,
  obtenerCaptura,
  obtenerOrden,
} from "@/lib/ordenes/data";
import { datosOrdenPdf } from "@/lib/ordenes/pdf-datos";
import { generarPdfOrden } from "@/lib/ordenes/pdf-documento";

/**
 * PDF de la orden de servicio, con el formato "Servicio RecondOil Box". Se
 * genera al momento, con el mismo permiso que ver la orden. Si la orden no
 * está cerrada, el documento lo advierte.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/ordenes/[id]/pdf">,
) {
  await requirePermiso("ordenes.ver");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return new NextResponse("No encontrado", { status: 404 });
  const o = await obtenerOrden(id);
  if (!o) return new NextResponse("No encontrado", { status: 404 });

  const [{ captura }, { nombres }, direccion, equipo] = await Promise.all([
    obtenerCaptura(o.id),
    directorioTecnicos(),
    o.planta_id ? direccionDePlanta(o.planta_id) : null,
    o.equipo_cliente_id ? equipoParaPdf(o.equipo_cliente_id) : null,
  ]);
  const catalogos = await catalogosCaptura(captura);

  const datos = datosOrdenPdf({
    orden: {
      folio: o.folio,
      tipo: o.tipo,
      estado: o.estado,
      fecha_programada: o.fecha_programada,
      fecha_real: o.fecha_real,
      cliente: o.cuentas?.nombre ?? null,
      planta: o.plantas?.nombre ?? null,
      direccion,
      robox: o.robox?.numero_serie ?? null,
      tecnico: nombres.get(o.tecnico_id) ?? "—",
      acompanante: o.acompanante_id
        ? (nombres.get(o.acompanante_id) ?? null)
        : null,
    },
    equipo,
    captura,
    actividades: catalogos.actividades,
    fallas: catalogos.fallas,
    partes: catalogos.partes,
  });
  const pdf = await generarPdfOrden(datos);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${datos.nombreArchivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
