/**
 * Menú del sistema. Cada entrada aparece solo si el rol del usuario tiene el
 * permiso indicado. Los módulos de etapas futuras se agregan aquí cuando existan.
 */

export type IconoMenu =
  | "inicio"
  | "clientes"
  | "oportunidades"
  | "flota"
  | "catalogos"
  | "parametros"
  | "usuarios";

export type EntradaMenu = {
  href: string;
  label: string;
  icono: IconoMenu;
  /** Sin permiso = visible para cualquier usuario interno. */
  permiso?: string;
};

export type GrupoMenu = { titulo: string | null; entradas: EntradaMenu[] };

const MENU: GrupoMenu[] = [
  {
    titulo: null,
    entradas: [{ href: "/", label: "Inicio", icono: "inicio" }],
  },
  {
    titulo: "Comercial",
    entradas: [
      {
        href: "/clientes",
        label: "Clientes",
        icono: "clientes",
        permiso: "clientes.ver",
      },
      {
        href: "/oportunidades",
        label: "Oportunidades",
        icono: "oportunidades",
        permiso: "oportunidades.ver",
      },
    ],
  },
  {
    titulo: "Operación",
    entradas: [
      { href: "/flota", label: "Flota", icono: "flota", permiso: "flota.ver" },
    ],
  },
  {
    titulo: "Configuración",
    entradas: [
      {
        href: "/catalogos",
        label: "Catálogos",
        icono: "catalogos",
        permiso: "catalogos.ver",
      },
      {
        href: "/parametros",
        label: "Parámetros",
        icono: "parametros",
        permiso: "parametros.ver",
      },
      {
        href: "/usuarios",
        label: "Usuarios",
        icono: "usuarios",
        permiso: "usuarios.administrar",
      },
    ],
  },
];

/** Menú filtrado por permisos; los grupos que quedan vacíos no se muestran. */
export function menuPara(permisos: readonly string[]): GrupoMenu[] {
  return MENU.map((grupo) => ({
    ...grupo,
    entradas: grupo.entradas.filter(
      (e) => !e.permiso || permisos.includes(e.permiso),
    ),
  })).filter((grupo) => grupo.entradas.length > 0);
}

/** ¿La entrada corresponde a la página actual? "/" solo coincide exacto. */
export function estaActiva(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
