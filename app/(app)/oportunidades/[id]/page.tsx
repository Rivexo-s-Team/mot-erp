import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { ESTADOS } from "@/lib/cotizaciones/campos";
import { cotizacionesDeOportunidad } from "@/lib/cotizaciones/data";
import { formatDia, formatFecha, formatImporte } from "@/lib/format";
import {
  CAMPOS_ETAPA,
  ETAPAS,
  etiqueta,
  ORIGENES,
  TIPOS,
  TIPOS_ACTIVIDAD,
} from "@/lib/pipeline/campos";
import { directorioComercial, obtenerOportunidad } from "@/lib/pipeline/data";
import { crearCotizacion } from "../cotizaciones-actions";
import { EtapaForm } from "../etapa-form";

export default async function OportunidadPage({
  params,
}: PageProps<"/oportunidades/[id]">) {
  const sesion = await requirePermiso("oportunidades.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [o, { nombres }] = await Promise.all([
    obtenerOportunidad(id),
    directorioComercial(),
  ]);
  if (!o) notFound();

  const edita = tienePermiso(sesion, "oportunidades.editar");
  // Las cotizaciones son precios: solo para quien puede verlos.
  const vePrecios = tienePermiso(sesion, "precios.ver");
  const cotizaciones = vePrecios ? await cotizacionesDeOportunidad(o.id) : [];
  const datos: [string, string][] = [
    ["Cliente", o.cuentas.nombre],
    ["Planta", o.plantas?.nombre ?? "Sin definir"],
    ["Tipo", etiqueta(TIPOS, o.tipo)],
    ["Origen", etiqueta(ORIGENES, o.origen)],
    ["Responsable", nombres.get(o.responsable_id) ?? "—"],
    ["Canal de venta", o.canales_venta?.nombre ?? "Venta directa"],
    [
      "Volumen estimado",
      o.volumen_estimado_l !== null ? `${o.volumen_estimado_l} L` : "—",
    ],
  ];
  if (o.fecha_cierre)
    datos.push(["Fecha de cierre", formatFecha(o.fecha_cierre)]);
  if (o.motivo_perdida) datos.push(["Motivo de la pérdida", o.motivo_perdida]);

  return (
    <>
      <title>{`${o.nombre} · Sistema MOT`}</title>
      <PageHeader title={o.nombre} description={o.cuentas.nombre}>
        <Link
          href="/oportunidades"
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Oportunidades
        </Link>
        {edita ? (
          <Link
            href={`/oportunidades/${o.id}/editar`}
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            Editar
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge>{etiqueta(ETAPAS, o.etapa)}</Badge>
        {o.etapa === "ganada" ? (
          <Badge variant="secondary">Pendiente de contrato</Badge>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                {datos.map(([titulo, valor]) => (
                  <div key={titulo} className="contents">
                    <dt className="text-muted-foreground">{titulo}</dt>
                    <dd>
                      {titulo === "Cliente" ? (
                        <Link
                          href={`/clientes/${o.cuenta_id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {valor}
                        </Link>
                      ) : (
                        valor
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {o.notas ? (
                <p className="mt-4 text-sm whitespace-pre-line text-muted-foreground">
                  {o.notas}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                Actividades
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {o.actividades.length}
                </span>
              </h2>
              {edita ? (
                <Link
                  href={`/oportunidades/${o.id}/actividades/nueva`}
                  className={buttonVariants({
                    variant: "outline",
                    className: "h-9",
                  })}
                >
                  Registrar actividad
                </Link>
              ) : null}
            </div>
            {o.actividades.length === 0 ? (
              <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aún no hay actividades registradas.
              </Card>
            ) : (
              <ul className="space-y-2">
                {o.actividades.map((a) => {
                  const tarjeta = (
                    <Card
                      className={`gap-1 px-4 py-3 ${edita ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {etiqueta(TIPOS_ACTIVIDAD, a.tipo)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDia(a.fecha)}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {nombres.get(a.responsable_id) ?? "—"}
                      </p>
                      {a.notas ? (
                        <p className="text-sm whitespace-pre-line">{a.notas}</p>
                      ) : null}
                    </Card>
                  );
                  return (
                    <li key={a.id}>
                      {edita ? (
                        <Link
                          href={`/oportunidades/${o.id}/actividades/${a.id}`}
                          className="block"
                        >
                          {tarjeta}
                        </Link>
                      ) : (
                        tarjeta
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {vePrecios ? (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  Cotizaciones
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {cotizaciones.length}
                  </span>
                </h2>
                {edita ? (
                  <form action={crearCotizacion.bind(null, o.id)}>
                    <Button type="submit" variant="outline" className="h-9">
                      Nueva cotización
                    </Button>
                  </form>
                ) : null}
              </div>
              {cotizaciones.length === 0 ? (
                <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Aún no hay cotizaciones.
                </Card>
              ) : (
                <ul className="space-y-2">
                  {cotizaciones.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/oportunidades/${o.id}/cotizaciones/${c.id}`}
                        className="block"
                      >
                        <Card className="gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">Versión {c.version}</p>
                            <Badge
                              variant={
                                c.estado === "enviada" ? "default" : "secondary"
                              }
                            >
                              {etiqueta(ESTADOS, c.estado)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground tabular-nums">
                            {c.totales.partidas} partidas · una sola vez{" "}
                            {formatImporte(c.totales.total_unico, c.moneda)} ·
                            recurrente{" "}
                            {formatImporte(
                              c.totales.total_recurrente,
                              c.moneda,
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Creada el {formatFecha(c.created_at)}
                            {c.vigencia
                              ? ` · vigente hasta ${formatDia(c.vigencia)}`
                              : ""}
                          </p>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>

        {edita ? (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Mover de etapa</CardTitle>
            </CardHeader>
            <CardContent>
              <EtapaForm
                // Al cambiar de etapa el formulario se reinicia con los datos guardados.
                key={`${o.etapa}:${o.motivo_perdida ?? ""}`}
                id={o.id}
                valores={valoresIniciales(CAMPOS_ETAPA, {
                  etapa: o.etapa,
                  motivo_perdida: o.motivo_perdida,
                })}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
