import Link from "next/link";
import { cerrarSesion } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

type UserBlockProps = { nombre: string; rol: string };

/** Pie del menú: quién está dentro, acceso a Mi cuenta y Salir. */
export function UserBlock({ nombre, rol }: UserBlockProps) {
  const iniciales = nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <Link
        href="/cuenta"
        title="Mi cuenta"
        className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {iniciales}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-medium">{nombre}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {rol}
          </span>
        </span>
      </Link>
      <form action={cerrarSesion}>
        <Button type="submit" variant="outline" className="h-9 w-full">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
