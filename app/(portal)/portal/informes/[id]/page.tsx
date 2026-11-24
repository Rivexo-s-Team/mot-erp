import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { InformeGraficas } from "@/components/informe-graficas";
import { InformeTendencias } from "@/components/informe-tendencias";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSesionPortal } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia } from "@/lib/format";
import { seriesDeTendencia } from "@/lib/laboratorio/graficas";
import { informeDelPortal } from "@/lib/portal/data";
import { CondicionBadge } from "../condicion-badge";

const enlace = "text-sm text-primary underline-offset-4 hover:underline";

export default async function InformePortalPage({
  params,
}: PageProps<"/portal/informes/[id]">) {
  await requireSesionPortal();
  const { id } = await params;
  const informe = z.uuid().safeParse(id).success
    ? await informeDelPortal(id)
    : null;
  if (!informe) notFound();

  const { contenido } = informe;
  const graficas = seriesDeTendencia(contenido);
  const datos: [string, string][] = [
    ["Planta", informe.planta],
    ["Equipo", nombreEquipo(informe.equipo)],
    ["Aceite", informe.equipo.aceite ?? "—"],
    ["Fecha de emisión", formatDia(informe.fecha_emision)],
    ["Elaboró", informe.elaboro ?? "—"],
    ["Validó", informe.valido ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <title>{`Informe ${informe.folio} · Portal MOT`}</title>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap gap-x-2">
            <Link href="/portal" className={enlace}>
              Portal
            </Link>
            <span aria-hidden className="text-sm text-muted-foreground">
              ›
            </span>
            <Link href="/portal/informes" className={enlace}>
              Informes
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Informe {informe.folio}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {nombreEquipo(informe.equipo)} · {informe.planta}
          </p>
        </div>
        <a
          href={`/portal/informes/${informe.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Descargar PDF
        </a>
      </div>

      {contenido.condicionGeneral ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Condición general del aceite:
          <CondicionBadge condicion={contenido.condicionGeneral} />
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Datos del informe</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              {datos.map(([nombre, valor]) => (
                <div key={nombre} className="contents">
                  <dt className="text-muted-foreground">{nombre}</dt>
                  <dd className="break-words">{valor}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-sm whitespace-pre-line ${informe.observaciones ? "" : "text-muted-foreground"}`}
            >
              {informe.observaciones ?? "Sin observaciones."}
            </p>
            {informe.recomienda_cambio_filtro ? (
              <p className="mt-3 text-sm font-medium">
                Se recomienda cambiar el filtro del Robox.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-1 text-lg font-semibold tracking-tight">
          Tendencias
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {contenido.muestras.length}{" "}
            {contenido.muestras.length === 1 ? "muestra" : "muestras"}
          </span>
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Una columna por muestra, de la más antigua a la más reciente. En rojo,
          lo que está fuera de su límite.
        </p>
        <InformeTendencias contenido={contenido} />
      </section>

      {graficas.length > 0 ? (
        <section>
          <h2 className="mb-1 text-lg font-semibold tracking-tight">
            Gráficas de tendencia
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Una por parámetro. Toca o pasa el cursor por un punto para ver su
            valor; los puntos huecos en rojo están fuera de su límite.
          </p>
          <InformeGraficas
            grupos={graficas}
            muestras={contenido.muestras.map((m) => ({
              idMuestra: m.idMuestra,
              fecha: m.fecha,
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}
