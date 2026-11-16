import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermiso } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Abre el archivo de un documento de acceso: revisa el permiso y redirige a un enlace que dura un minuto. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/archivos/documento-acceso/[id]">,
) {
  await requirePermiso("documentos_acceso.ver");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return new NextResponse("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documentos_acceso")
    .select("archivo_ruta")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!doc?.archivo_ruta)
    return new NextResponse("No encontrado", { status: 404 });

  const { data } = await supabase.storage
    .from("documentos-acceso")
    .createSignedUrl(doc.archivo_ruta, 60);
  if (!data) return new NextResponse("No encontrado", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
