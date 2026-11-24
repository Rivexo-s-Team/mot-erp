import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSesionPortal } from "@/lib/auth/session";
import { direccionPlanta } from "@/lib/clientes/campos";
import { datosInformePdf } from "@/lib/laboratorio/pdf-datos";
import { generarPdfInforme } from "@/lib/laboratorio/pdf-documento";
import { informeDelPortal } from "@/lib/portal/data";

/**
 * PDF de un informe publicado, para el cliente. Es el mismo documento que
 * imprime MOT; solo sale si el informe es de su cuenta y está publicado.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/portal/informes/[id]/pdf">,
) {
  await requireSesionPortal();
  const { id } = await ctx.params;
  const informe = z.uuid().safeParse(id).success
    ? await informeDelPortal(id)
    : null;
  if (!informe) return new NextResponse("No encontrado", { status: 404 });

  const datos = datosInformePdf({
    informe: {
      folio: informe.folio,
      estado: "validado",
      fecha_emision: informe.fecha_emision,
      observaciones: informe.observaciones,
      recomienda_cambio_filtro: informe.recomienda_cambio_filtro,
      cliente: informe.cliente,
      planta: informe.planta,
      direccion: direccionPlanta(informe.direccion) || null,
      elaboro: informe.elaboro,
      valido: informe.valido,
      validado_el: informe.validado_at
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Mexico_City",
          }).format(new Date(informe.validado_at))
        : null,
    },
    equipo: informe.equipo,
    idCaso: informe.id_caso,
    contenido: informe.contenido,
  });
  const pdf = await generarPdfInforme(datos);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${datos.nombreArchivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
