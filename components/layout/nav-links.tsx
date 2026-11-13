"use client";

import {
  BookOpen,
  Building2,
  Home,
  ClipboardList,
  Cpu,
  KanbanSquare,
  Package,
  ScrollText,
  Smartphone,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { estaActiva, type GrupoMenu, type IconoMenu } from "@/lib/navegacion";

const ICONOS: Record<IconoMenu, LucideIcon> = {
  inicio: Home,
  clientes: Building2,
  oportunidades: KanbanSquare,
  contratos: ScrollText,
  flota: Cpu,
  inventario: Package,
  ordenes: ClipboardList,
  campo: Smartphone,
  catalogos: BookOpen,
  parametros: SlidersHorizontal,
  usuarios: Users,
};

type NavLinksProps = {
  menu: GrupoMenu[];
  /** Se llama al tocar un enlace (para cerrar el menú en celular). */
  onNavigate?: () => void;
};

export function NavLinks({ menu, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menú principal" className="flex flex-col gap-5">
      {menu.map((grupo) => (
        <div key={grupo.titulo ?? "general"} className="flex flex-col gap-1">
          {grupo.titulo ? (
            <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {grupo.titulo}
            </p>
          ) : null}
          {grupo.entradas.map((entrada) => {
            const Icono = ICONOS[entrada.icono];
            const activa = estaActiva(entrada.href, pathname);
            return (
              <Link
                key={entrada.href}
                href={entrada.href}
                onClick={onNavigate}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  activa
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icono
                  className={cn("size-4 shrink-0", activa && "text-primary")}
                  aria-hidden
                />
                {entrada.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
