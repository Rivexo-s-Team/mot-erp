import Link from "next/link";
import { Suspense } from "react";
import { cerrarSesion } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSesion, tienePermiso } from "@/lib/auth/session";

// El menú completo por rol llega en el paso 5; por ahora solo lo que ya existe.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link href="/" aria-label="Inicio" className="shrink-0">
          <Logo priority className="h-8" />
        </Link>
        <Suspense fallback={<Skeleton className="ml-auto h-7 w-40" />}>
          <HeaderSesion />
        </Suspense>
      </div>
    </header>
  );
}

async function HeaderSesion() {
  const sesion = await requireSesion();

  return (
    <>
      <nav className="flex min-w-0 items-center gap-1 text-sm">
        {tienePermiso(sesion, "usuarios.administrar") ? (
          <Link
            href="/usuarios"
            className="rounded-md px-2.5 py-1.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Usuarios
          </Link>
        ) : null}
      </nav>
      <div className="ml-auto flex min-w-0 items-center gap-3">
        <Link
          href="/cuenta"
          title="Mi cuenta"
          className="flex min-w-0 items-center gap-3 rounded-md px-1.5 py-1 hover:bg-muted"
        >
          <span className="hidden min-w-0 text-right leading-tight sm:block">
            <span className="block truncate text-sm font-medium">
              {sesion.nombre}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {sesion.correo}
            </span>
          </span>
          <Badge variant="secondary">{sesion.rol.nombre}</Badge>
        </Link>
        <form action={cerrarSesion}>
          <Button type="submit" variant="outline" size="sm">
            Salir
          </Button>
        </form>
      </div>
    </>
  );
}
