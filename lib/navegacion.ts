/**
 * Menú del sistema. Cada entrada aparece solo si el rol del usuario tiene el
 * permiso indicado. Los módulos de etapas futuras se agregan aquí cuando existan.
 */

export type IconoMenu =
  | "inicio"
  | "clientes"
  | "oportunidades"
  | "contratos"
  | "flota"
  | "inventario"
  | "documentos"
  | "cargos"
  | "facturas"
  | "pagos"
  | "cobranza"
  | "muestras"
  | "informes"
  | "ordenes"
  | "agenda"
  | "campo"
  | "catalogos"
  | "parametros"
  | "usuarios"
  | "bitacora"
  | "direccion";

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
    entradas: [
      { href: "/", label: "Inicio", icono: "inicio" },
      {
        href: "/direccion",
        label: "Dirección",
        icono: "direccion",
        permiso: "direccion.ver",
      },
    ],
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
      {
        href: "/contratos",
        label: "Contratos",
        icono: "contratos",
        permiso: "contratos.ver",
      },
    ],
  },
  {
    titulo: "Operación",
    entradas: [
      {
        href: "/agenda",
        label: "Agenda",
        icono: "agenda",
        permiso: "ordenes.ver",
      },
      {
        href: "/ordenes",
        label: "Órdenes de servicio",
        icono: "ordenes",
        permiso: "ordenes.ver",
      },
      {
        href: "/campo",
        label: "Campo (celular)",
        icono: "campo",
        permiso: "ordenes.editar",
      },
      { href: "/flota", label: "Flota", icono: "flota", permiso: "flota.ver" },
      {
        href: "/inventario",
        label: "Inventario",
        icono: "inventario",
        permiso: "inventario.ver",
      },
      {
        href: "/documentos-acceso",
        label: "Documentos de acceso",
        icono: "documentos",
        permiso: "documentos_acceso.ver",
      },
    ],
  },
  {
    titulo: "Laboratorio",
    entradas: [
      {
        href: "/laboratorio/muestras",
        label: "Muestras",
        icono: "muestras",
        permiso: "laboratorio.ver",
      },
      {
        href: "/laboratorio/informes",
        label: "Informes",
        icono: "informes",
        permiso: "laboratorio.ver",
      },
    ],
  },
  {
    titulo: "Administración",
    entradas: [
      {
        href: "/cargos",
        label: "Cargos por facturar",
        icono: "cargos",
        permiso: "cargos.ver",
      },
      {
        href: "/facturas",
        label: "Facturas",
        icono: "facturas",
        permiso: "facturacion.ver",
      },
      {
        href: "/pagos",
        label: "Pagos",
        icono: "pagos",
        permiso: "facturacion.ver",
      },
      {
        href: "/cobranza",
        label: "Cuentas por cobrar",
        icono: "cobranza",
        permiso: "facturacion.ver",
      },
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
      {
        href: "/bitacora",
        label: "Bitácora",
        icono: "bitacora",
        permiso: "bitacora.ver",
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
