import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BUCKETS } from "@/lib/archivos/config";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Abre el comprobante de precio de una partida. Es un precio: exige precios.ver. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/archivos/comprobante/[linea]">,
) {
  const sesion = await requirePermiso("oportunidades.ver");
  const { linea } = await ctx.params;
  if (
    !tienePermiso(sesion, "precios.ver") ||
    !z.uuid().safeParse(linea).success
  ) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const supabase = await createClient();
  const { data: partida } = await supabase
    .from("cotizacion_lineas")
    .select("fuente_archivo_ruta")
    .eq("id", linea)
    .is("deleted_at", null)
    .maybeSingle();
  if (!partida?.fuente_archivo_ruta)
    return new NextResponse("No encontrado", { status: 404 });

  const { data } = await supabase.storage
    .from(BUCKETS.comprobante)
    .createSignedUrl(partida.fuente_archivo_ruta, 60);
  if (!data) return new NextResponse("No encontrado", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
