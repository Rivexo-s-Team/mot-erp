import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EstadoOrdenBadge } from "@/components/orden-estado-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { agruparPorDia, cercania, textoFrecuencia } from "@/lib/agenda/campos";
import { listarVisitas } from "@/lib/agenda/data";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia, hoyEnMexico } from "@/lib/format";
import {
  directorioTecnicos,
  listarOrdenes,
  lugarOrden,
} from "@/lib/ordenes/data";
import { ProgramarVisita } from "./programar-visita";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: PageProps<"/agenda">) {
  const sesion = await requirePermiso("ordenes.ver");
  const { ver } = await searchParams;
  const puedeEditar = tienePermiso(sesion, "ordenes.editar");
  // "Mis visitas" solo tiene sentido para quien lleva órdenes.
  const soloMias = puedeEditar && ver === "mias";

  const [ordenes, visitas, { nombres }] = await Promise.all([
    listarOrdenes({
      abiertas: true,
      personaId: soloMias ? sesion.id : undefined,
    }),
    listarVisitas({ soloActivas: true }),
    directorioTecnicos(),
  ]);
  const hoy = hoyEnMexico();
  const dias = agruparPorDia(ordenes, (o) => o.fecha_programada);
  const recurrentes = soloMias
    ? visitas.filter((v) => v.tecnico_id === sesion.id || v.tecnico_id === null)
    : visitas;

  const etiquetaDia = (dia: string) => {
    const c = cercania(dia, hoy);
    return c === "hoy" ? `Hoy, ${formatDia(dia)}` : formatDia(dia);
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Visitas programadas y visitas recurrentes de los contratos."
      >
        {puedeEditar ? (
          <>
            <Link
              href="/agenda/recurrentes/nueva"
              className={buttonVariants({
                variant: "outline",
                className: "h-9",
              })}
            >
              Nueva recurrente
            </Link>
            <Link
              href="/ordenes/nueva"
              className={buttonVariants({ className: "h-9" })}
            >
              Nueva orden
            </Link>
          </>
        ) : null}
      </PageHeader>

      {puedeEditar ? (
        <nav aria-label="Filtrar agenda" className="mb-4 flex flex-wrap gap-2">
          {[
            { href: "/agenda", label: "Todas", activo: !soloMias },
            { href: "/agenda?ver=mias", label: "Las mías", activo: soloMias },
          ].map((f) => (
            <Link
              key={f.href}
              href={f.href}
              aria-current={f.activo ? "true" : undefined}
              className={buttonVariants({
                variant: f.activo ? "default" : "outline",
                size: "sm",
                className: "h-8",
              })}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Visitas programadas
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {ordenes.length}
            </span>
          </h2>
          {dias.length === 0 ? (
            <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
              No hay órdenes programadas ni en curso.
            </Card>
          ) : (
            <div className="space-y-4">
              {dias.map(({ dia, elementos }) => (
                <div key={dia}>
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    {etiquetaDia(dia)}
                    {cercania(dia, hoy) === "atrasada" ? (
                      <Badge variant="destructive">Atrasada</Badge>
                    ) : null}
                  </p>
                  <ul className="space-y-2">
                    {elementos.map((o) => (
                      <li key={o.id}>
                        <Link href={`/ordenes/${o.id}`} className="block">
                          <Card className="gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-medium">{lugarOrden(o)}</p>
                              <EstadoOrdenBadge estado={o.estado} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {nombres.get(o.tecnico_id) ?? "—"}
                              {o.equipos_cliente
                                ? ` · ${nombreEquipo(o.equipos_cliente)}`
                                : ""}{" "}
                              · {o.folio}
                            </p>
                          </Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Visitas recurrentes
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {recurrentes.length}
            </span>
          </h2>
          {recurrentes.length === 0 ? (
            <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
              No hay visitas recurrentes. Se definen por contrato: cada cuánto
              se visita la planta.
            </Card>
          ) : (
            <ul className="space-y-2">
              {recurrentes.map((v) => {
                const c = cercania(v.proxima_fecha, hoy);
                return (
                  <li key={v.id}>
                    <Card className="gap-2 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {v.contratos.cuentas.nombre} ·{" "}
                            {v.contratos.plantas?.nombre ?? "—"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {textoFrecuencia(v.cada_cantidad, v.cada_unidad)}
                            {v.equipos_cliente
                              ? ` · ${nombreEquipo(v.equipos_cliente)}`
                              : ""}
                            {v.tecnico_id
                              ? ` · ${nombres.get(v.tecnico_id) ?? "—"}`
                              : ""}
                          </p>
                        </div>
                        {puedeEditar ? <ProgramarVisita id={v.id} /> : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <p className="flex items-center gap-2">
                          Toca el {formatDia(v.proxima_fecha)}
                          {c === "atrasada" ? (
                            <Badge variant="destructive">Sin programar</Badge>
                          ) : c === "hoy" ? (
                            <Badge>Hoy</Badge>
                          ) : null}
                        </p>
                        {puedeEditar ? (
                          <Link
                            href={`/agenda/recurrentes/${v.id}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            Editar
                          </Link>
                        ) : null}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
