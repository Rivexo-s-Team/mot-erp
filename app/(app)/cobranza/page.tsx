import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import {
  antiguedadDeSaldos,
  diasDeAtraso,
  nombreEstadoPortal,
  textoAtraso,
  totalesPorMoneda,
  TRAMOS,
} from "@/lib/facturacion/cobranza";
import { fechaVencimiento } from "@/lib/facturacion/credito";
import { facturasPorCobrar, portalDeFacturas } from "@/lib/facturacion/data";
import { folioFactura } from "@/lib/facturacion/facturas";
import { formatDia, formatImporte, hoyEnMexico } from "@/lib/format";

export const metadata: Metadata = { title: "Cuentas por cobrar" };

export default async function CobranzaPage() {
  await requirePermiso("facturacion.ver");
  const facturas = await facturasPorCobrar();
  const portales = await portalDeFacturas(facturas.map((f) => f.id));
  const hoy = hoyEnMexico();
  const renglones = antiguedadDeSaldos(
    facturas.map((f) => ({ ...f, saldo: f.saldos.saldo })),
    hoy,
  );
  const totales = totalesPorMoneda(renglones);
  const nombre = new Map(
    facturas.map((f) => [
      f.razon_social_id,
      {
        razon: f.razones_sociales?.razon_social ?? "—",
        cuenta: f.cuentas?.nombre ?? "—",
        cuentaId: f.cuenta_id,
      },
    ]),
  );
  // Las más atrasadas primero.
  const lista = facturas
    .map((f) => ({ ...f, atraso: diasDeAtraso(f, hoy) }))
    .sort((a, b) => b.atraso - a.atraso);

  return (
    <>
      <PageHeader
        title="Cuentas por cobrar"
        description="Lo que deben los clientes, por razón social, según los días de crédito de cada factura."
      />

      {facturas.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          No hay facturas emitidas con saldo por cobrar.
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {totales.map((t) => (
              <Card key={t.moneda} className="gap-1 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Por cobrar en {t.moneda}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatImporte(t.total, t.moneda)}
                </p>
                <p
                  className={`text-sm tabular-nums ${t.vencido > 0 ? "font-medium text-destructive" : "text-muted-foreground"}`}
                >
                  {t.vencido > 0
                    ? `Vencido ${formatImporte(t.vencido, t.moneda)}`
                    : "Nada vencido"}
                </p>
              </Card>
            ))}
          </div>

          <section>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              Antigüedad de saldos
            </h2>
            <ul className="space-y-2">
              {renglones.map((r) => {
                const n = nombre.get(r.razon_social_id);
                return (
                  <li key={`${r.razon_social_id}-${r.moneda}`}>
                    <Card className="gap-2 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium break-words">{n?.razon}</p>
                          <p className="text-sm text-muted-foreground">
                            <Link
                              href={`/clientes/${n?.cuentaId}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {n?.cuenta}
                            </Link>{" "}
                            · {r.facturas}{" "}
                            {r.facturas === 1 ? "factura" : "facturas"}
                          </p>
                        </div>
                        <p className="font-medium tabular-nums">
                          {formatImporte(r.total, r.moneda)}
                        </p>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
                        {TRAMOS.map((t) => {
                          const v = r.tramos[t.clave];
                          const vencido = t.clave !== "por_vencer" && v > 0;
                          return (
                            <div key={t.clave}>
                              <dt className="text-muted-foreground">
                                {t.label}
                              </dt>
                              <dd
                                className={`tabular-nums ${vencido ? "font-medium text-destructive" : v === 0 ? "text-muted-foreground" : ""}`}
                              >
                                {v === 0 ? "—" : formatImporte(v, r.moneda)}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              Facturas por cobrar
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {lista.length}
              </span>
            </h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {lista.map((f) => {
                const portal = portales.get(f.id);
                const usaPortal =
                  portal || f.razones_sociales?.usa_portal_proveedores;
                return (
                  <li key={f.id}>
                    <Link href={`/facturas/${f.id}`} className="block h-full">
                      <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-medium break-words">
                            {folioFactura(f)} ·{" "}
                            {f.razones_sociales?.razon_social ?? "—"}
                          </p>
                          <p className="font-medium tabular-nums">
                            {formatImporte(f.saldos.saldo, f.moneda)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Emitida {formatDia(f.fecha)} · vence{" "}
                          {formatDia(fechaVencimiento(f.fecha, f.dias_credito))}
                          {f.saldos.pagado > 0
                            ? ` · pagado ${formatImporte(f.saldos.pagado, f.moneda)}`
                            : ""}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant={f.atraso > 0 ? "destructive" : "outline"}
                          >
                            {textoAtraso(f.atraso)}
                          </Badge>
                          {usaPortal ? (
                            <Badge variant="secondary">
                              Portal: {nombreEstadoPortal(portal?.estado)}
                              {portal?.fecha_pago_programado &&
                              portal.estado === "programada"
                                ? ` · ${formatDia(portal.fecha_pago_programado)}`
                                : ""}
                            </Badge>
                          ) : null}
                        </div>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
