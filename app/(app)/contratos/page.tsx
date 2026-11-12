import type { Metadata } from "next";
import Link from "next/link";
import { EstadoContratoBadge } from "@/components/contrato-estado-badge";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { ESTADOS_CONTRATO, textoVigencia } from "@/lib/contratos/campos";
import {
  contarContratosPorEstado,
  listarContratos,
  nombreContrato,
  totalesDeContratos,
} from "@/lib/contratos/data";
import { formatDia, formatImporte } from "@/lib/format";

export const metadata: Metadata = { title: "Contratos" };

export default async function ContratosPage({
  searchParams,
}: PageProps<"/contratos">) {
  const sesion = await requirePermiso("contratos.ver");
  const { estado: estadoParam } = await searchParams;
  const estado = ESTADOS_CONTRATO.some((e) => e.value === estadoParam)
    ? String(estadoParam)
    : "";

  const [contratos, { conteo, total }] = await Promise.all([
    listarContratos({ estado }),
    contarContratosPorEstado(),
  ]);
  const vePrecios = tienePermiso(sesion, "precios.ver");
  const totales = vePrecios
    ? await totalesDeContratos(contratos.map((c) => c.id))
    : new Map();
  const filtros = [
    { value: "", label: "Todos", cantidad: total },
    ...ESTADOS_CONTRATO.map((e) => ({
      ...e,
      cantidad: conteo.get(e.value) ?? 0,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Lo negociado con cada planta: tipo, vigencia y tarifas."
      >
        {tienePermiso(sesion, "contratos.editar") ? (
          <Link
            href="/contratos/nuevo"
            className={buttonVariants({ className: "h-9" })}
          >
            Nuevo contrato
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
            href={f.value ? `/contratos?estado=${f.value}` : "/contratos"}
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

      {contratos.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          {total === 0
            ? "Todavía no hay contratos."
            : "No hay contratos en ese estado."}
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contratos.map((c) => {
            const t = totales.get(c.id);
            return (
              <li key={c.id}>
                <Link href={`/contratos/${c.id}`} className="block h-full">
                  <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">{c.cuentas.nombre}</p>
                      <EstadoContratoBadge estado={c.estado} />
                    </div>
                    <p className="text-sm">
                      {nombreContrato(c)}
                      {c.referencia ? ` · ${c.referencia}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {textoVigencia(
                        c.fecha_inicio,
                        c.fecha_termino,
                        formatDia,
                      )}
                    </p>
                    {t ? (
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {t.tarifas} {t.tarifas === 1 ? "tarifa" : "tarifas"}
                        {Number(t.total_mensual) > 0
                          ? ` · ${formatImporte(t.total_mensual, c.moneda)} al mes`
                          : ""}
                      </p>
                    ) : null}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
