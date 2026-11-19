import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { listarPagos } from "@/lib/facturacion/data";
import { nombreFormaPago } from "@/lib/facturacion/pagos";
import { formatDia, formatImporte } from "@/lib/format";

export const metadata: Metadata = { title: "Pagos" };

export default async function PagosPage() {
  const sesion = await requirePermiso("facturacion.ver");
  const edita = tienePermiso(sesion, "facturacion.editar");
  const pagos = await listarPagos();

  return (
    <>
      <PageHeader
        title="Pagos"
        description="Pagos recibidos de los clientes y a qué facturas se aplicaron."
      >
        {edita ? (
          <Link
            href="/pagos/nuevo"
            className={buttonVariants({ className: "h-9" })}
          >
            Registrar pago
          </Link>
        ) : null}
      </PageHeader>

      {pagos.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          Aún no hay pagos registrados.
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {pagos.map((p) => (
            <li key={p.id}>
              <Link href={`/pagos/${p.id}`} className="block h-full">
                <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium break-words">
                      {p.razones_sociales?.razon_social ?? "—"}
                    </p>
                    <p className="font-medium tabular-nums">
                      {formatImporte(p.monto, p.moneda)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {p.cuentas?.nombre ?? "—"} · {formatDia(p.fecha)}
                    {p.forma_pago ? ` · ${nombreFormaPago(p.forma_pago)}` : ""}
                    {p.referencia ? ` · ${p.referencia}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {p.saldos.por_aplicar > 0 ? (
                      <Badge variant="secondary">
                        Por aplicar{" "}
                        {formatImporte(p.saldos.por_aplicar, p.moneda)}
                      </Badge>
                    ) : (
                      <Badge variant="exito">Aplicado</Badge>
                    )}
                    {p.rep_folio ? (
                      <Badge variant="outline">Complemento {p.rep_folio}</Badge>
                    ) : null}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
