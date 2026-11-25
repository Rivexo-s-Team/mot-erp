import type { Metadata } from "next";
import Link from "next/link";
import { FileText, FlaskConical, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireSesionPortal } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Portal de clientes" };

const SECCIONES: {
  icono: typeof FileText;
  titulo: string;
  texto: string;
  href?: string;
  accion?: string;
}[] = [
  {
    icono: FlaskConical,
    titulo: "Laboratorio",
    texto: "Informes de análisis de aceite de tus equipos, con sus tendencias.",
    href: "/portal/informes",
    accion: "Ver informes",
  },
  {
    icono: FileText,
    titulo: "Facturas y pagos",
    texto: "Facturas con saldo, pagos aplicados y descarga de XML y PDF.",
    href: "/portal/facturas",
    accion: "Ver facturas",
  },
  {
    icono: Wrench,
    titulo: "Órdenes de servicio",
    texto: "Visitas realizadas en tus plantas, con su reporte firmado.",
  },
];

export default async function PortalPage() {
  const sesion = await requireSesionPortal();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {sesion.cuenta.nombre}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hola, {sesion.nombre}. Aquí podrás consultar la información de tu
          empresa con Molecular Oil Technology.
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        {SECCIONES.map(({ icono: Icono, titulo, texto, href, accion }) => (
          <li key={titulo}>
            {href ? (
              <Link href={href} className="block h-full">
                <Card className="h-full gap-2 px-4 py-4 transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <Icono aria-hidden className="size-5 text-primary" />
                  <p className="font-medium">{titulo}</p>
                  <p className="text-sm text-muted-foreground">{texto}</p>
                  <p className="text-sm font-medium text-primary">{accion}</p>
                </Card>
              </Link>
            ) : (
              <Card className="h-full gap-2 px-4 py-4">
                <Icono aria-hidden className="size-5 text-primary" />
                <p className="font-medium">{titulo}</p>
                <p className="text-sm text-muted-foreground">{texto}</p>
                <p className="text-xs font-medium text-muted-foreground">
                  Disponible próximamente
                </p>
              </Card>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
