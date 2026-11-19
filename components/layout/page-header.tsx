import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type Miga = { label: string; href: string };

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Ruta de navegación: de dónde cuelga esta pantalla, de lo general a lo particular. */
  migas?: Miga[];
  /** Botones de acción, a la derecha. */
  children?: ReactNode;
};

export function PageHeader({
  title,
  description,
  migas,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {migas && migas.length > 0 ? (
        <nav aria-label="Ruta" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {migas.map((m) => (
              <li key={m.href} className="flex items-center gap-1">
                <Link
                  href={m.href}
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  {m.label}
                </Link>
                <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children ? (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
