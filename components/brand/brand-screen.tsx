import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

type BrandScreenProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

/** Pantalla centrada con la marca: bienvenida, acceso y secciones en construcción. */
export function BrandScreen({
  title,
  description,
  children,
}: BrandScreenProps) {
  return (
    <div className="relative flex flex-1 flex-col bg-muted/40">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-marca-azul via-marca-cian to-marca-verde"
      />
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
          <Logo priority className="mx-auto h-16" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-pretty text-muted-foreground">
            {description}
          </p>
          {children ? <div className="mt-8">{children}</div> : null}
        </section>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground">
        Molecular Oil Technology · Desarrollado por Rivexo
      </footer>
    </div>
  );
}
