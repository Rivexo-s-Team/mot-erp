import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EstadoOrdenBadge } from "@/components/orden-estado-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { formatDia } from "@/lib/format";
import { ESTADOS_ORDEN } from "@/lib/ordenes/campos";
import {
  contarOrdenesPorEstado,
  directorioTecnicos,
  listarOrdenes,
  lugarOrden,
} from "@/lib/ordenes/data";

export const metadata: Metadata = { title: "Órdenes de servicio" };

export default async function OrdenesPage({
  searchParams,
}: PageProps<"/ordenes">) {
  const sesion = await requirePermiso("ordenes.ver");
  const { estado: estadoParam } = await searchParams;
  const estado = ESTADOS_ORDEN.some((e) => e.value === estadoParam)
    ? String(estadoParam)
    : "";

  const [ordenes, { conteo, total }, { nombres }] = await Promise.all([
    listarOrdenes({ estado }),
    contarOrdenesPorEstado(),
    directorioTecnicos(),
  ]);
  const filtros = [
    { value: "", label: "Todas", cantidad: total },
    ...ESTADOS_ORDEN.map((e) => ({
      ...e,
      cantidad: conteo.get(e.value) ?? 0,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Órdenes de servicio"
        description="Visitas a planta y trabajos de taller."
      >
        {tienePermiso(sesion, "ordenes.editar") ? (
          <Link
            href="/ordenes/nueva"
            className={buttonVariants({ className: "h-9" })}
          >
            Nueva orden
          </Link>
        ) : null}
      </PageHeader>

      <nav
        aria-label="Filtrar por estado"
        className="mb-4 flex flex-wrap gap-2"
      >
        {filtros.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/ordenes?estado=${f.value}` : "/ordenes"}
            aria-current={f.value === estado ? "true" : undefined}
            className={buttonVariants({
              variant: f.value === estado ? "default" : "outline",
              size: "sm",
              className: "h-8",
            })}
          >
            {f.label}
            <span className="tabular-nums opacity-70">{f.cantidad}</span>
          </Link>
        ))}
      </nav>

      {ordenes.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          {total === 0
            ? "Todavía no hay órdenes de servicio."
            : "No hay órdenes en ese estado."}
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ordenes.map((o) => (
            <li key={o.id}>
              <Link href={`/ordenes/${o.id}`} className="block h-full">
                <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium tabular-nums">{o.folio}</p>
                    <EstadoOrdenBadge estado={o.estado} />
                  </div>
                  <p className="text-sm">{lugarOrden(o)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDia(o.fecha_real ?? o.fecha_programada)} ·{" "}
                    {nombres.get(o.tecnico_id) ?? "—"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
