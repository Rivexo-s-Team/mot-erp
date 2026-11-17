import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BUCKETS } from "@/lib/archivos/config";
import { requirePermiso } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Abre el XML o el PDF de una factura: revisa el permiso y redirige a un enlace que dura un minuto. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/archivos/factura/[id]/[tipo]">,
) {
  await requirePermiso("facturacion.ver");
  const { id, tipo } = await ctx.params;
  if (!z.uuid().safeParse(id).success || (tipo !== "xml" && tipo !== "pdf"))
    return new NextResponse("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: factura } = await supabase
    .from("facturas")
    .select("xml_ruta, pdf_ruta, serie, folio")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  const ruta = tipo === "xml" ? factura?.xml_ruta : factura?.pdf_ruta;
  if (!ruta) return new NextResponse("No encontrado", { status: 404 });

  const nombre = `Factura_${[factura?.serie, factura?.folio].filter(Boolean).join("-")}.${tipo}`;
  const { data } = await supabase.storage
    .from(BUCKETS.factura)
    // El XML se descarga con su nombre; el PDF se abre en el navegador.
    .createSignedUrl(ruta, 60, tipo === "xml" ? { download: nombre } : {});
  if (!data) return new NextResponse("No encontrado", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
