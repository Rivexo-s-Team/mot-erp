import type { NextRequest } from "next/server";
import { direccionDePlanta } from "@/lib/cotizaciones/data";
import { datosParaPdf } from "@/lib/cotizaciones/pdf-datos";
import { generarPdfCotizacion } from "@/lib/cotizaciones/pdf-documento";
import { cargarCotizacion } from "../contexto";

/**
 * PDF de la cotización para el cliente. Se genera al momento, con los mismos
 * permisos que ver la cotización (pipeline y precios).
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/oportunidades/[id]/cotizaciones/[cotizacion]/pdf">,
) {
  const { id, cotizacion: cotizacionId } = await ctx.params;
  const { oportunidad, cotizacion } = await cargarCotizacion(id, cotizacionId);

  const datos = datosParaPdf({
    oportunidad: {
      cliente: oportunidad.cuentas.nombre,
      planta: oportunidad.plantas?.nombre ?? null,
      direccion: oportunidad.planta_id
        ? await direccionDePlanta(oportunidad.planta_id)
        : null,
    },
    cotizacion,
  });
  const pdf = await generarPdfCotizacion(datos);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${datos.nombreArchivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
