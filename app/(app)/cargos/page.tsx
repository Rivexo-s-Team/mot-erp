import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import {
  centavosATexto,
  ESTADOS_CARGO,
  etiqueta,
  porCompletar,
  TIPOS_CARGO,
  totalesPendientes,
} from "@/lib/cargos/campos";
import { listarCargos } from "@/lib/cargos/data";
import { formatFecha, formatImporte } from "@/lib/format";

export const metadata: Metadata = { title: "Cargos por facturar" };

export default async function CargosPage({
  searchParams,
}: PageProps<"/cargos">) {
  const sesion = await requirePermiso("cargos.ver");
  // Son importes: sin permiso de precios no hay nada que mostrar.
  if (!tienePermiso(sesion, "precios.ver")) redirect("/");
  const { estado: estadoParam } = await searchParams;
  const estado =
    estadoParam === "todos"
      ? ""
      : ESTADOS_CARGO.some((e) => e.value === estadoParam)
        ? String(estadoParam)
        : "pendiente";
  const edita = tienePermiso(sesion, "cargos.editar");
  const veFacturas = tienePermiso(sesion, "facturacion.ver");

  const [cargos, pendientes] = await Promise.all([
    listarCargos({ estado }),
    estado === "pendiente" ? null : listarCargos({ estado: "pendiente" }),
  ]);
  const totales = totalesPendientes(pendientes ?? cargos);
  const filtros = [...ESTADOS_CARGO, { value: "todos", label: "Todos" }];

  return (
    <>
      <PageHeader
        title="Cargos por facturar"
        description="Lo que nace de las órdenes de servicio y falta cobrar. La factura se emitirá desde aquí en la etapa de facturación."
      >
        <Link
          href="/cargos/rentas"
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Rentas del mes
        </Link>
        {edita ? (
          <Link
            href="/cargos/nuevo"
            className={buttonVariants({ className: "h-9" })}
          >
            Nuevo cargo
          </Link>
        ) : null}
      </PageHeader>

      <p className="mb-4 text-sm">
        <span className="text-muted-foreground">Pendiente de facturar: </span>
        <span className="font-medium tabular-nums">
          {totales.length === 0
            ? "nada"
            : totales
                .map((t) => formatImporte(centavosATexto(t.centavos), t.moneda))
                .join(" · ")}
        </span>
        <span className="text-muted-foreground"> (sin IVA)</span>
      </p>

      <nav
        aria-label="Filtrar por estado"
        className="mb-4 flex flex-wrap gap-2"
      >
        {filtros.map((f) => {
          const activo = (estado || "todos") === f.value;
          return (
            <Link
              key={f.value}
              href={`/cargos?estado=${f.value}`}
              aria-current={activo ? "true" : undefined}
              className={buttonVariants({
                variant: activo ? "default" : "outline",
                size: "sm",
                className: "h-8",
              })}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {cargos.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          No hay cargos en este estado.
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {cargos.map((c) => {
            const tarjeta = (
              <Card
                className={`h-full gap-1 px-4 py-3 ${edita && c.estado !== "facturado" ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{c.cuentas?.nombre ?? "—"}</p>
                  <p className="font-medium tabular-nums">
                    {c.importe !== null
                      ? formatImporte(c.importe, c.moneda)
                      : "Por completar"}
                  </p>
                </div>
                <p className="text-sm break-words">{c.concepto}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {etiqueta(TIPOS_CARGO, c.tipo)}
                  {c.cantidad !== null && c.precio_unitario !== null
                    ? ` · ${c.cantidad} ${c.unidad ?? ""} × ${formatImporte(c.precio_unitario, c.moneda)}`
                    : ""}{" "}
                  · {formatFecha(c.created_at)}
                </p>
                <div className="flex flex-wrap gap-1">
                  {c.factura_id ? (
                    <Badge variant="secondary">En una factura</Badge>
                  ) : null}
                  {porCompletar(c) && c.estado === "pendiente" ? (
                    <Badge variant="destructive">Por completar</Badge>
                  ) : null}
                  {c.estado !== "pendiente" ? (
                    <Badge variant="outline">
                      {etiqueta(ESTADOS_CARGO, c.estado)}
                    </Badge>
                  ) : null}
                </div>
              </Card>
            );
            return (
              <li key={c.id}>
                {c.factura_id && veFacturas ? (
                  <Link
                    href={`/facturas/${c.factura_id}`}
                    className="block h-full"
                  >
                    {tarjeta}
                  </Link>
                ) : edita && c.estado !== "facturado" && !c.factura_id ? (
                  <Link href={`/cargos/${c.id}`} className="block h-full">
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
    </>
  );
}
