import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermiso } from "@/lib/auth/session";
import { direccionDePlanta } from "@/lib/cotizaciones/data";
import {
  contenidoDeInforme,
  equipoParaInformePdf,
  idCasoDeMuestra,
  obtenerInforme,
} from "@/lib/laboratorio/data";
import { datosInformePdf } from "@/lib/laboratorio/pdf-datos";
import { generarPdfInforme } from "@/lib/laboratorio/pdf-documento";
import { directorioTecnicos } from "@/lib/ordenes/data";

/**
 * PDF del informe de laboratorio, con el formato "Análisis de tendencias en
 * aceites" de MOT. Se genera al momento, con el mismo permiso que ver el
 * informe. Si no está validado, el documento lo advierte.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/laboratorio/informes/[id]/pdf">,
) {
  await requirePermiso("laboratorio.ver");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return new NextResponse("No encontrado", { status: 404 });
  const informe = await obtenerInforme(id);
  if (!informe) return new NextResponse("No encontrado", { status: 404 });

  const [contenido, { nombres }, direccion, equipo] = await Promise.all([
    contenidoDeInforme(informe),
    directorioTecnicos(),
    direccionDePlanta(informe.planta_id),
    equipoParaInformePdf(informe.equipo_cliente_id),
  ]);
  const ultima = contenido.muestras.at(-1);
  const persona = (uid: string | null) =>
    uid ? (nombres.get(uid) ?? null) : null;

  const datos = datosInformePdf({
    informe: {
      folio: informe.folio,
      estado: informe.estado,
      fecha_emision: informe.fecha_emision,
      observaciones: informe.observaciones,
      cliente: informe.cuentas?.nombre ?? null,
      planta: informe.plantas?.nombre ?? null,
      direccion,
      elaboro: persona(informe.elaboro_id),
      valido: persona(informe.valido_id),
      validado_el: informe.validado_at
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Mexico_City",
          }).format(new Date(informe.validado_at))
        : null,
    },
    equipo,
    idCaso: ultima ? await idCasoDeMuestra(ultima.id) : null,
    contenido,
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
