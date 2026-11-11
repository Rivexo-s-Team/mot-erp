import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { formatDia, formatFecha } from "@/lib/format";
import {
  CAMPOS_ETAPA,
  ETAPAS,
  etiqueta,
  ORIGENES,
  TIPOS,
  TIPOS_ACTIVIDAD,
} from "@/lib/pipeline/campos";
import { directorioComercial, obtenerOportunidad } from "@/lib/pipeline/data";
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
