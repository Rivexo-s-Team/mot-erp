import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSesion } from "@/lib/auth/session";
import { menuPara } from "@/lib/navegacion";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { UserBlock } from "./user-block";

const SIDEBAR =
  "fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r bg-sidebar lg:flex";
const TOPBAR =
  "sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden";

/**
 * Navegación del sistema: barra lateral en escritorio y barra superior con
 * menú desplegable en celular. Muestra solo lo que el rol puede usar.
 */
export async function AppNav() {
  const sesion = await requireSesion();
  const menu = menuPara(sesion.permisos);
  const usuario = <UserBlock nombre={sesion.nombre} rol={sesion.rol.nombre} />;

  return (
    <>
      <aside className={SIDEBAR}>
        <div className="flex h-16 shrink-0 items-center border-b px-5">
          <Link href="/" aria-label="Inicio">
            <Logo priority className="h-9" />
          </Link>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          <NavLinks menu={menu} />
          <div className="mt-auto">{usuario}</div>
        </div>
      </aside>

      <header className={TOPBAR}>
        <MobileNav menu={menu} logo={<Logo className="h-8" />}>
          {usuario}
        </MobileNav>
        <Link href="/" aria-label="Inicio" className="mx-auto">
          <Logo priority className="h-8" />
        </Link>
        {/* Equilibra el botón de menú para que el logo quede centrado. */}
        <span className="size-9" aria-hidden />
      </header>
    </>
  );
}

/** Se muestra mientras se lee la sesión. */
export function AppNavSkeleton() {
  return (
    <>
      <aside className={SIDEBAR} aria-busy>
        <div className="flex h-16 shrink-0 items-center border-b px-5">
          <Logo priority className="h-9" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </aside>
      <header className={TOPBAR} aria-busy>
        <Skeleton className="size-9" />
        <Logo priority className="mx-auto h-8" />
        <span className="size-9" aria-hidden />
      </header>
    </>
  );
}
