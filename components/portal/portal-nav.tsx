"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/portal", label: "Inicio", raices: [] as string[] },
  { href: "/portal/informes", label: "Laboratorio", raices: [] },
  {
    href: "/portal/facturas",
    label: "Facturas y pagos",
    raices: ["/portal/pagos"],
  },
  { href: "/portal/ordenes", label: "Órdenes de servicio", raices: [] },
];

/** Menú del portal: una fila que se desliza en celular. */
export function PortalNav() {
  const ruta = usePathname();
  const activa = (s: (typeof SECCIONES)[number]) =>
    s.href === "/portal"
      ? ruta === "/portal"
      : [s.href, ...s.raices].some(
          (r) => ruta === r || ruta.startsWith(`${r}/`),
        );

  return (
    <nav
      aria-label="Secciones del portal"
      className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2"
    >
      {SECCIONES.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={activa(s) ? "page" : undefined}
          className={`border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
            activa(s)
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
