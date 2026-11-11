import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { formatFecha } from "@/lib/format";
import {
  ETAPAS,
  ETAPAS_ABIERTAS,
  ETAPAS_CERRADAS,
} from "@/lib/pipeline/campos";
import {
  directorioComercial,
  listarOportunidades,
  type Oportunidad,
} from "@/lib/pipeline/data";

export const metadata: Metadata = { title: "Oportunidades" };

export default async function OportunidadesPage({
  searchParams,
}: PageProps<"/oportunidades">) {
  const sesion = await requirePermiso("oportunidades.ver");
  const cerradas = (await searchParams).ver === "cerradas";
  const [oportunidades, { nombres }] = await Promise.all([
    listarOportunidades(cerradas),
    directorioComercial(),
  ]);
  const columnas = cerradas
    ? ETAPAS.filter((e) => ETAPAS_CERRADAS.includes(e.value))
    : ETAPAS_ABIERTAS;

  return (
    <>
      <PageHeader
        title="Oportunidades"
        description={
          cerradas
            ? "Ventas ganadas y perdidas."
            : "Ventas en curso, por etapa. Abre una para moverla o registrar actividades."
        }
      >
        <Link
          href={cerradas ? "/oportunidades" : "/oportunidades?ver=cerradas"}
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          {cerradas ? "Ver en curso" : "Ver cerradas"}
        </Link>
        {tienePermiso(sesion, "oportunidades.editar") ? (
          <Link
            href="/oportunidades/nueva"
            className={buttonVariants({ className: "h-9" })}
          >
            Nueva oportunidad
          </Link>
        ) : null}
      </PageHeader>

      {/* Celular: etapas una debajo de otra. Escritorio: columnas con desplazamiento horizontal. */}
      <div className="flex flex-col gap-4 lg:-mx-6 lg:flex-row lg:gap-3 lg:overflow-x-auto lg:px-6 lg:pb-4">
        {columnas.map((etapa) => {
          const tarjetas = oportunidades.filter((o) => o.etapa === etapa.value);
          return (
            <section
              key={etapa.value}
              className="lg:w-64 lg:shrink-0"
              aria-label={etapa.label}
            >
              <h2 className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
                {etapa.label}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {tarjetas.length}
                </span>
              </h2>
              {tarjetas.length === 0 ? (
                <p className="hidden rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground lg:block">
                  Sin oportunidades
                </p>
              ) : (
                <ul className="space-y-2">
                  {tarjetas.map((o) => (
                    <li key={o.id}>
                      <TarjetaOportunidad
                        o={o}
                        responsable={nombres.get(o.responsable_id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function TarjetaOportunidad({
  o,
  responsable,
}: {
  o: Oportunidad;
  responsable?: string;
}) {
  return (
    <Link href={`/oportunidades/${o.id}`} className="block">
      <Card className="gap-1 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40">
        <p className="text-sm font-medium">{o.nombre}</p>
        <p className="text-sm text-muted-foreground">
          {o.cuentas.nombre}
          {o.plantas ? ` · ${o.plantas.nombre}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {responsable ?? "Sin responsable"}
          {o.volumen_estimado_l !== null ? ` · ${o.volumen_estimado_l} L` : ""}
        </p>
        <div className="flex flex-wrap gap-1 pt-0.5">
          {o.canales_venta ? (
            <Badge variant="outline">{o.canales_venta.nombre}</Badge>
          ) : null}
          {o.etapa === "ganada" ? (
            <Badge variant="secondary">Pendiente de contrato</Badge>
          ) : null}
          {o.fecha_cierre ? (
            <Badge variant="outline">{formatFecha(o.fecha_cierre)}</Badge>
          ) : null}
        </div>
        {o.etapa === "perdida" && o.motivo_perdida ? (
          <p className="text-xs text-muted-foreground">
            Motivo: {o.motivo_perdida}
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
