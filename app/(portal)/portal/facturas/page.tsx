import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireSesionPortal } from "@/lib/auth/session";
import { fechaVencimiento } from "@/lib/facturacion/credito";
import { folioFactura } from "@/lib/facturacion/facturas";
import { formatDia, formatImporte, hoyEnMexico } from "@/lib/format";
import { facturasDelPortal } from "@/lib/portal/data";
import {
  ESTADOS_DE_PAGO,
  estadoDePago,
  saldosPorMoneda,
} from "@/lib/portal/facturas";
import { PestanasFacturacion } from "./pestanas";

export const metadata: Metadata = { title: "Facturas" };

export default async function FacturasPortalPage() {
  await requireSesionPortal();
  const facturas = await facturasDelPortal();
  const hoy = hoyEnMexico();
  const saldos = saldosPorMoneda(facturas, hoy);
  const conSaldo = facturas.filter((f) => f.saldo > 0);
  const pagadas = facturas.filter((f) => f.saldo <= 0);

  const lista = (filas: typeof facturas) => (
    <ul className="grid gap-3 md:grid-cols-2">
      {filas.map((f) => {
        const estado = ESTADOS_DE_PAGO[estadoDePago(f, hoy)];
        return (
          <li key={f.id}>
            <Link href={`/portal/facturas/${f.id}`} className="block h-full">
              <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">
                    Factura {folioFactura(f) || "sin folio"}
                    {f.es_anticipo ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · Anticipo
                      </span>
                    ) : null}
                  </p>
                  <Badge variant={estado.variante}>{estado.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {f.razon_social}
                </p>
                <p className="text-sm">
                  {formatDia(f.fecha)}
                  <span className="text-muted-foreground">
                    {" "}
                    · vence el{" "}
                    {formatDia(fechaVencimiento(f.fecha, f.dias_credito))}
                  </span>
                </p>
                <p className="text-sm tabular-nums">
                  <span className="text-muted-foreground">Total </span>
                  {formatImporte(f.total, f.moneda)}
                  {f.saldo > 0 ? (
                    <>
                      <span className="text-muted-foreground"> · Saldo </span>
                      <span className="font-medium">
                        {formatImporte(f.saldo, f.moneda)}
                      </span>
                    </>
                  ) : null}
                </p>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Facturas y pagos
        </h1>
      </div>
      <PestanasFacturacion actual="/portal/facturas" />

      {saldos.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {saldos.map((s) => (
            <li key={s.moneda}>
              <Card className="gap-1 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Saldo por pagar · {s.facturas}{" "}
                  {s.facturas === 1 ? "factura" : "facturas"}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatImporte(s.saldo, s.moneda)}
                </p>
                {s.vencido > 0 ? (
                  <p className="text-sm text-destructive tabular-nums">
                    Vencido: {formatImporte(s.vencido, s.moneda)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Nada vencido</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {facturas.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-muted-foreground">
          Aún no hay facturas.
        </Card>
      ) : null}
      {conSaldo.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Con saldo
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {conSaldo.length}
            </span>
          </h2>
          {lista(conSaldo)}
        </section>
      ) : facturas.length > 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          No tienes facturas con saldo.
        </Card>
      ) : null}
      {pagadas.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Pagadas
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {pagadas.length}
            </span>
          </h2>
          {lista(pagadas)}
        </section>
      ) : null}
    </div>
  );
}
