import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_PUBLICAS = ["/login"];

/**
 * Renueva la sesión de Supabase en cada petición y manda a /login a quien no
 * ha iniciado sesión. Es solo el primer filtro: los permisos se revisan en
 * cada página y, sobre todo, en las políticas RLS de la base.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // Sin esto la app falla con un "Internal Server Error" que no dice nada.
    return new NextResponse(
      "Sistema MOT: faltan variables de entorno en este despliegue " +
        "(NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). " +
        "Revisa el README, sección Variables de entorno.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const conSesion = Boolean(data?.claims.sub);
  const { pathname } = request.nextUrl;
  const esPublica = RUTAS_PUBLICAS.includes(pathname);

  if (!conSesion && !esPublica) return redirigir(request, response, "/login");
  if (conSesion && esPublica) return redirigir(request, response, "/");
  return response;
}

function redirigir(
  request: NextRequest,
  response: NextResponse,
  destino: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = destino;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  // Conserva las cookies de sesión renovadas.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  // Todo menos archivos estáticos e imágenes.
  matcher: [
    "/((?!_next/static|_next/image|icon.png|apple-icon.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
