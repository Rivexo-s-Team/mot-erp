import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSesionPortal } from "@/lib/auth/session";
import { direccionPlanta } from "@/lib/clientes/campos";
import { armarCaptura } from "@/lib/ordenes/captura";
import { datosOrdenPdf } from "@/lib/ordenes/pdf-datos";
import { generarPdfOrden } from "@/lib/ordenes/pdf-documento";
import { ordenDelPortal } from "@/lib/portal/data";

/**
 * Reporte de una visita cerrada, para el cliente. Es el mismo documento que
 * imprime MOT; solo sale si la visita es de su cuenta y está cerrada.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/portal/ordenes/[id]/pdf">,
) {
  await requireSesionPortal();
  const { id } = await ctx.params;
  const o = z.uuid().safeParse(id).success ? await ordenDelPortal(id) : null;
  if (!o) return new NextResponse("No encontrado", { status: 404 });

  const datos = datosOrdenPdf({
    orden: {
      folio: o.orden.folio,
      tipo: o.orden.tipo,
      estado: o.orden.estado,
      fecha_programada: o.orden.fecha_programada,
      fecha_real: o.orden.fecha_real,
      cliente: o.orden.cliente,
      planta: o.orden.planta,
      direccion: direccionPlanta(o.orden.direccion) || null,
      robox: o.orden.robox,
      tecnico: o.orden.tecnico ?? "—",
      acompanante: o.orden.acompanante,
    },
    equipo: o.equipo,
    captura: armarCaptura(o.filas),
    actividades: o.catalogos.actividades,
    fallas: o.catalogos.fallas,
    partes: o.catalogos.partes,
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
