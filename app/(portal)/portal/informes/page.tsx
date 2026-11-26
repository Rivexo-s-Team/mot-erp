import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireSesionPortal } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia } from "@/lib/format";
import { CONDICIONES } from "@/lib/laboratorio/evaluacion";
import { informesDelPortal } from "@/lib/portal/data";
import { CondicionBadge } from "./condicion-badge";

export const metadata: Metadata = { title: "Informes de laboratorio" };

export default async function InformesPortalPage() {
  await requireSesionPortal();
  const informes = await informesDelPortal();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Informes de laboratorio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Análisis de aceite de tus equipos. Cada informe muestra la tendencia
          de sus muestras.
        </p>
      </div>
      {informes.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-muted-foreground">
          Aún no hay informes publicados.
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {informes.map((i) => (
            <li key={i.id}>
              <Link href={`/portal/informes/${i.id}`} className="block h-full">
                <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium">
                      {nombreEquipo({
                        identificador: i.equipo,
                        alias: i.equipo_alias,
                      })}
                    </p>
                    {i.condicion_general in CONDICIONES ? (
                      <CondicionBadge
                        condicion={
                          i.condicion_general as keyof typeof CONDICIONES
                        }
                      />
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{i.planta}</p>
                  <p className="text-sm">
                    {formatDia(i.fecha_emision)}
                    <span className="text-muted-foreground">
                      {" "}
                      · Informe {i.folio} · {i.muestras}{" "}
                      {i.muestras === 1 ? "muestra" : "muestras"}
                    </span>
                  </p>
                  {i.recomienda_cambio_filtro ? (
                    <div className="pt-1">
                      <Badge variant="aviso">
                        Se recomienda cambiar el filtro
                      </Badge>
                    </div>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
