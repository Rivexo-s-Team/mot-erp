import Link from "next/link";
import { Suspense } from "react";
import { cerrarSesion } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSesionPortal } from "@/lib/auth/session";

/** Portal de clientes: diseño propio, sin el menú interno de MOT. */
export default function PortalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <div
        aria-hidden
        className="h-1 bg-linear-to-r from-marca-azul via-marca-cian to-marca-verde"
      />
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/portal" aria-label="Inicio del portal">
            <Logo priority className="h-8" />
          </Link>
          <Suspense fallback={<Skeleton className="h-8 w-40" />}>
            <Usuario />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Suspense
          fallback={
            <div className="space-y-3" aria-busy>
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-28 w-full" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground">
        Molecular Oil Technology · Portal de clientes
      </footer>
    </div>
  );
}

async function Usuario() {
  const sesion = await requireSesionPortal();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link
        href="/portal/cuenta"
        title="Mi cuenta"
        className="min-w-0 text-right leading-tight hover:underline"
      >
        <span className="block truncate text-sm font-medium">
          {sesion.nombre}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {sesion.cuenta.nombre}
        </span>
      </Link>
      <form action={cerrarSesion}>
        <Button type="submit" variant="outline" size="sm">
          Salir
        </Button>
      </form>
    </div>
  );
}
