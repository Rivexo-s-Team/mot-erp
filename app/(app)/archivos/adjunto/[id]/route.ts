import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BUCKETS } from "@/lib/archivos/config";
import { requirePermiso } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Abre un adjunto de oportunidad: revisa el permiso y redirige a un enlace que dura un minuto. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/archivos/adjunto/[id]">,
) {
  await requirePermiso("oportunidades.ver");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return new NextResponse("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: adjunto } = await supabase
    .from("oportunidad_adjuntos")
    .select("ruta")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!adjunto) return new NextResponse("No encontrado", { status: 404 });

  const { data } = await supabase.storage
    .from(BUCKETS.adjunto)
    .createSignedUrl(adjunto.ruta, 60);
  if (!data) return new NextResponse("No encontrado", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
