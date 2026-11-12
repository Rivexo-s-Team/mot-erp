import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";

/** Sección de campo: pensada para el celular del técnico, sin menú lateral. */
export default function CampoLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
        <Link href="/campo" aria-label="Mis órdenes">
          <Logo priority className="h-8" />
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ir al sistema
        </Link>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-5">
        <Suspense
          fallback={
            <div className="space-y-3" aria-busy>
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}
