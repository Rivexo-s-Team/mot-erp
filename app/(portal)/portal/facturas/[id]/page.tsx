import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSesionPortal } from "@/lib/auth/session";
import { fechaVencimiento, METODOS_PAGO } from "@/lib/facturacion/credito";
import { etiqueta, folioFactura } from "@/lib/facturacion/facturas";
import { nombreFormaPago } from "@/lib/facturacion/pagos";
import { formatDia, formatImporte, hoyEnMexico } from "@/lib/format";
import { facturaDelPortal } from "@/lib/portal/data";
import { ESTADOS_DE_PAGO, estadoDePago } from "@/lib/portal/facturas";

const enlace = "text-sm text-primary underline-offset-4 hover:underline";

export default async function FacturaPortalPage({
  params,
}: PageProps<"/portal/facturas/[id]">) {
  await requireSesionPortal();
  const { id } = await params;
  const f = z.uuid().safeParse(id).success ? await facturaDelPortal(id) : null;
  if (!f) notFound();

  const estado = ESTADOS_DE_PAGO[estadoDePago(f, hoyEnMexico())];
  const folio = folioFactura(f) || "sin folio";
  const datos: [string, string][] = [
    ["Razón social", `${f.razon_social} · ${f.rfc}`],
    ["Fecha", formatDia(f.fecha)],
    ["Vence", formatDia(fechaVencimiento(f.fecha, f.dias_credito))],
    ["Método de pago", etiqueta(METODOS_PAGO, f.metodo_pago)],
    ["Orden de compra", f.orden_compra ?? "—"],
    ["Folio fiscal", f.uuid_fiscal ?? "—"],
  ];
  const totales: [string, number, boolean][] = [
    ["Subtotal", f.subtotal, false],
    ["IVA", f.iva, false],
    ["Total", f.total, true],
    ["Pagado", f.pagado, false],
    ["Saldo", f.saldo, true],
  ];

  return (
    <div className="space-y-6">
      <title>{`Factura ${folio} · Portal MOT`}</title>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap gap-x-2">
            <Link href="/portal" className={enlace}>
              Portal
            </Link>
            <span aria-hidden className="text-sm text-muted-foreground">
              ›
            </span>
            <Link href="/portal/facturas" className={enlace}>
              Facturas
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Factura {folio}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={estado.variante}>{estado.label}</Badge>
            {f.es_anticipo ? <Badge variant="secondary">Anticipo</Badge> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pdf", "xml"] as const).map((tipo) =>
            f[`tiene_${tipo}`] ? (
              <a
                key={tipo}
                href={`/portal/facturas/${f.id}/archivo/${tipo}`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                  variant: "outline",
                  className: "h-9",
                })}
              >
                {tipo === "pdf" ? "Ver PDF" : "Descargar XML"}
              </a>
            ) : null,
          )}
        </div>
      </div>
      {!f.tiene_pdf && !f.tiene_xml ? (
        <p className="text-sm text-muted-foreground">
          El PDF y el XML de esta factura aún no están disponibles aquí.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Datos de la factura</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              {datos.map(([nombre, valor]) => (
                <div key={nombre} className="contents">
                  <dt className="text-muted-foreground">{nombre}</dt>
                  <dd className="break-words">{valor}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Importes</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
              {totales.map(([nombre, valor, fuerte]) => (
                <div
                  key={nombre}
                  className={`contents ${fuerte ? "font-semibold" : ""}`}
                >
                  <dt className={fuerte ? "" : "text-muted-foreground"}>
                    {nombre}
                  </dt>
                  <dd className="text-right tabular-nums">
                    {formatImporte(valor, f.moneda)}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Conceptos</h2>
        <Card className="gap-0 divide-y py-0">
          {f.conceptos.map((c, i) => (
            <div
              key={i}
              className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1 basis-56">
                <p className="whitespace-pre-line">{c.descripcion}</p>
                <p className="text-muted-foreground tabular-nums">
                  {c.cantidad} {c.unidad ?? ""} ×{" "}
                  {formatImporte(c.precio_unitario, f.moneda)}
                </p>
              </div>
              <p className="font-medium tabular-nums">
                {formatImporte(c.importe, f.moneda)}
              </p>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-sm text-muted-foreground">Importes sin IVA.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Pagos aplicados
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {f.pagos.length}
          </span>
        </h2>
        {f.pagos.length === 0 ? (
          <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
            Esta factura aún no tiene pagos aplicados.
          </Card>
        ) : (
          <Card className="gap-0 divide-y py-0">
            {f.pagos.map((p, i) => (
              <div
                key={i}
                className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <p>
                    {formatDia(p.fecha)}
                    <span className="text-muted-foreground">
                      {" "}
                      ·{" "}
                      {p.es_anticipo
                        ? "Aplicación de anticipo"
                        : nombreFormaPago(p.forma_pago)}
                    </span>
                  </p>
                  <p className="break-all text-muted-foreground">
                    {p.rep_folio
                      ? `${p.es_anticipo ? "CFDI de egreso" : "Complemento de pago"} ${p.rep_folio} · ${p.rep_uuid}`
                      : f.metodo_pago === "PPD"
                        ? "Complemento de pago pendiente"
                        : ""}
                  </p>
                </div>
                <p className="font-medium tabular-nums">
                  {formatImporte(p.monto, f.moneda)}
                </p>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
