import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BUCKETS } from "@/lib/archivos/config";
import { requireSesionPortal } from "@/lib/auth/session";
import { facturaDelPortal, rutaArchivoFacturaPortal } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";

/**
 * Abre el XML o el PDF de una factura del cliente: redirige a un enlace que
 * dura un minuto. La base decide si la factura es suya, y la política del
 * almacén vuelve a comprobarlo al firmar el enlace.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/portal/facturas/[id]/archivo/[tipo]">,
) {
  await requireSesionPortal();
  const { id, tipo } = await ctx.params;
  if (!z.uuid().safeParse(id).success || (tipo !== "xml" && tipo !== "pdf"))
    return new NextResponse("No encontrado", { status: 404 });

  const [ruta, factura] = await Promise.all([
    rutaArchivoFacturaPortal(id, tipo),
    facturaDelPortal(id),
  ]);
  if (!ruta || !factura)
    return new NextResponse("No encontrado", { status: 404 });

  const nombre = `Factura_${[factura.serie, factura.folio].filter(Boolean).join("-")}.${tipo}`;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(BUCKETS.factura)
    // El XML se descarga con su nombre; el PDF se abre en el navegador.
    .createSignedUrl(ruta, 60, tipo === "xml" ? { download: nombre } : {});
  if (!data) return new NextResponse("No encontrado", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
