import { Busqueda } from "@/components/busqueda";
import { TablaLista } from "@/components/tabla-lista";
import { coincide } from "@/lib/buscar";
import type { Metadata } from "next";
import Link from "next/link";
import { EstadoFacturaBadge } from "@/components/factura-estado-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import {
  listarFacturas,
  saldosDeFacturas,
  type SaldoFactura,
} from "@/lib/facturacion/data";
import { ESTADOS_FACTURA, folioFactura } from "@/lib/facturacion/facturas";
import { ESTADOS_COBRO, estadoCobro } from "@/lib/facturacion/pagos";
import { formatDia, formatImporte } from "@/lib/format";

export const metadata: Metadata = { title: "Facturas" };

export default async function FacturasPage({
  searchParams,
}: PageProps<"/facturas">) {
  const sesion = await requirePermiso("facturacion.ver");
  const { estado: estadoParam, q } = await searchParams;
  const busqueda = typeof q === "string" ? q : "";
  const estado = ESTADOS_FACTURA.some((e) => e.value === estadoParam)
    ? String(estadoParam)
    : "";
  const edita = tienePermiso(sesion, "facturacion.editar");
  const facturas = (await listarFacturas({ estado })).filter((f) =>
    coincide(busqueda, [
      folioFactura(f),
      f.razones_sociales?.razon_social,
      f.razones_sociales?.rfc,
      f.cuentas?.nombre,
      f.orden_compra,
    ]),
  );
  const saldos = await saldosDeFacturas(
    facturas.filter((f) => f.estado === "emitida").map((f) => f.id),
  );
  const filtros = [{ value: "", label: "Todas" }, ...ESTADOS_FACTURA];

  return (
    <>
      <PageHeader
        title="Facturas"
        description="Se arman con los cargos por facturar. Por ahora se timbran fuera del sistema."
      >
        {edita ? (
          <Link
            href="/facturas/nueva"
            className={buttonVariants({ className: "h-9" })}
          >
            Nueva factura
          </Link>
        ) : null}
      </PageHeader>

      <nav
        aria-label="Filtrar por estado"
        className="mb-4 flex flex-wrap gap-2"
      >
        {filtros.map((f) => {
          const activo = estado === f.value;
          return (
            <Link
              key={f.value}
              href={f.value ? `/facturas?estado=${f.value}` : "/facturas"}
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

      <Busqueda
        accion="/facturas"
        valor={busqueda}
        placeholder="Buscar por folio, cliente o razón social…"
        conservar={{ estado }}
      />

      {facturas.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          No hay facturas
          {busqueda
            ? ` que coincidan con "${busqueda}"`
            : estado
              ? " en este estado"
              : ""}
          .
        </Card>
      ) : (
        <>
          <TablaLista
            filas={facturas}
            clave={(f) => f.id}
            href={(f) => `/facturas/${f.id}`}
            columnas={[
              { titulo: "Folio", celda: (f) => folioFactura(f) || "Borrador" },
              {
                titulo: "Razón social",
                celda: (f) => f.razones_sociales?.razon_social ?? "—",
              },
              { titulo: "Cliente", celda: (f) => f.cuentas?.nombre ?? "—" },
              { titulo: "Fecha", celda: (f) => formatDia(f.fecha) },
              {
                titulo: "Estado",
                celda: (f) => (
                  <span className="flex flex-wrap gap-1">
                    <EstadoFacturaBadge estado={f.estado} />
                    {f.es_anticipo ? (
                      <Badge variant="outline">Anticipo</Badge>
                    ) : null}
                    {saldos.has(f.id) ? (
                      <CobroBadge saldo={saldos.get(f.id)} moneda={f.moneda} />
                    ) : null}
                  </span>
                ),
              },
              {
                titulo: "Total con IVA",
                derecha: true,
                celda: (f) =>
                  formatImporte(f.factura_totales?.total ?? 0, f.moneda),
              },
            ]}
          />
          <ul className="grid gap-3 lg:grid-cols-2 lg:hidden">
            {facturas.map((f) => (
              <li key={f.id}>
                <Link href={`/facturas/${f.id}`} className="block h-full">
                  <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium break-words">
                        {f.razones_sociales?.razon_social ?? "—"}
                      </p>
                      <p className="font-medium tabular-nums">
                        {formatImporte(f.factura_totales?.total ?? 0, f.moneda)}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {folioFactura(f) ? `${folioFactura(f)} · ` : ""}
                      {f.cuentas?.nombre ?? "—"} · {formatDia(f.fecha)} ·{" "}
                      {f.factura_totales?.conceptos ?? 0}{" "}
                      {f.factura_totales?.conceptos === 1
                        ? "concepto"
                        : "conceptos"}{" "}
                      · total con IVA
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <EstadoFacturaBadge estado={f.estado} />
                      {f.es_anticipo ? (
                        <Badge variant="outline">Anticipo</Badge>
                      ) : null}
                      {saldos.has(f.id) ? (
                        <CobroBadge
                          saldo={saldos.get(f.id)}
                          moneda={f.moneda}
                        />
                      ) : null}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** Cómo va el cobro de una factura emitida. */
function CobroBadge({
  saldo,
  moneda,
}: {
  saldo: SaldoFactura | undefined;
  moneda: string;
}) {
  if (!saldo) return null;
  return (
    <Badge variant={saldo.saldo <= 0 ? "exito" : "aviso"}>
      {ESTADOS_COBRO[estadoCobro(saldo)]}
      {saldo.saldo > 0 ? ` · saldo ${formatImporte(saldo.saldo, moneda)}` : ""}
    </Badge>
  );
}
