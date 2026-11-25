import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireSesionPortal } from "@/lib/auth/session";
import { folioFactura } from "@/lib/facturacion/facturas";
import { nombreFormaPago } from "@/lib/facturacion/pagos";
import { formatDia, formatImporte } from "@/lib/format";
import { pagosDelPortal } from "@/lib/portal/data";
import { PestanasFacturacion } from "../facturas/pestanas";

export const metadata: Metadata = { title: "Pagos" };

export default async function PagosPortalPage() {
  await requireSesionPortal();
  const pagos = await pagosDelPortal();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/portal"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Portal
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Facturas y pagos
        </h1>
      </div>
      <PestanasFacturacion actual="/portal/pagos" />
      <p className="text-sm text-muted-foreground">
        Pagos que MOT ha registrado, con su complemento y las facturas a las que
        se aplicaron.
      </p>

      {pagos.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-muted-foreground">
          Aún no hay pagos registrados.
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {pagos.map((p) => (
            <li key={p.id}>
              <Card className="h-full gap-1 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium tabular-nums">
                    {formatImporte(p.monto, p.moneda)}
                  </p>
                  {p.por_aplicar > 0 ? (
                    <Badge variant="aviso">
                      Por aplicar {formatImporte(p.por_aplicar, p.moneda)}
                    </Badge>
                  ) : (
                    <Badge variant="exito">Aplicado</Badge>
                  )}
                </div>
                <p className="text-sm">
                  {formatDia(p.fecha)}
                  <span className="text-muted-foreground">
                    {" "}
                    ·{" "}
                    {p.es_anticipo
                      ? "Aplicación de anticipo"
                      : nombreFormaPago(p.forma_pago)}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.razon_social}
                </p>
                {p.aplicaciones.length > 0 ? (
                  <ul className="text-sm">
                    {p.aplicaciones.map((a) => (
                      <li key={a.factura_id} className="tabular-nums">
                        <Link
                          href={`/portal/facturas/${a.factura_id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          Factura {folioFactura(a) || "sin folio"}
                        </Link>
                        <span className="text-muted-foreground">
                          {" "}
                          · {formatImporte(a.monto, p.moneda)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-sm break-all text-muted-foreground">
                  {p.rep_folio
                    ? `${p.es_anticipo ? "CFDI de egreso" : "Complemento de pago"} ${p.rep_folio} · ${p.rep_uuid}`
                    : "Sin complemento registrado"}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
