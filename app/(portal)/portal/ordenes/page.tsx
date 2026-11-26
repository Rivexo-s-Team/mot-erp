import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSesionPortal } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia } from "@/lib/format";
import { ordenesDelPortal } from "@/lib/portal/data";

export const metadata: Metadata = { title: "Órdenes de servicio" };

export default async function OrdenesPortalPage() {
  await requireSesionPortal();
  const ordenes = await ordenesDelPortal();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/portal"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Portal
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Órdenes de servicio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visitas concluidas en tus plantas. El reporte es el que firmó tu
          responsable al terminar el servicio.
        </p>
      </div>
      {ordenes.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-muted-foreground">
          Aún no hay visitas concluidas.
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {ordenes.map((o) => (
            <li key={o.id}>
              <Card className="h-full gap-1 px-4 py-3">
                <p className="font-medium">
                  {formatDia(o.fecha)}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · Orden {o.folio}
                  </span>
                </p>
                <p className="text-sm">
                  {o.planta}
                  {o.equipo ? (
                    <span className="text-muted-foreground">
                      {" "}
                      ·{" "}
                      {nombreEquipo({
                        identificador: o.equipo,
                        alias: o.equipo_alias,
                      })}
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  Técnico: {o.tecnico}
                  {o.robox ? ` · Robox ${o.robox}` : ""}
                </p>
                <div className="pt-1">
                  <a
                    href={`/portal/ordenes/${o.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Ver reporte (PDF)
                  </a>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
