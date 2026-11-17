import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { EstadoFacturaBadge } from "@/components/factura-estado-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import {
  etiqueta,
  fechaVencimiento,
  FORMAS_PAGO,
  METODOS_PAGO,
} from "@/lib/facturacion/credito";
import {
  conceptosDeFactura,
  creditoDeCuenta,
  obtenerFactura,
} from "@/lib/facturacion/data";
import {
  accionesFactura,
  faltantesParaTimbrar,
} from "@/lib/facturacion/facturas";
import { formatDia, formatImporte } from "@/lib/format";
import { quitarConcepto } from "../actions";

const enlace = "text-primary underline-offset-4 hover:underline";

export default async function FacturaPage({
  params,
}: PageProps<"/facturas/[id]">) {
  const sesion = await requirePermiso("facturacion.ver");
  const { id } = await params;
  const f = z.uuid().safeParse(id).success ? await obtenerFactura(id) : null;
  if (!f) notFound();
  const [conceptos, credito] = await Promise.all([
    conceptosDeFactura(f.id),
    creditoDeCuenta(f.cuenta_id),
  ]);
  const edita =
    tienePermiso(sesion, "facturacion.editar") &&
    accionesFactura(f.estado).editar;
  const razon = f.razones_sociales;
  const totales = f.factura_totales;
  const faltantes =
    f.estado === "borrador"
      ? faltantesParaTimbrar({
          ...f,
          razon,
          requiereOrdenCompra:
            credito.get(f.razon_social_id)?.requiere_orden_compra ?? false,
          conceptos,
        })
      : [];

  const datos: [string, ReactNode][] = [
    [
      "Cliente",
      <Link key="c" href={`/clientes/${f.cuenta_id}`} className={enlace}>
        {f.cuentas?.nombre ?? "—"}
      </Link>,
    ],
    ["Razón social", razon ? `${razon.razon_social} · ${razon.rfc}` : "—"],
    ["Fecha", formatDia(f.fecha)],
    [
      "Vence",
      f.dias_credito === 0
        ? "De contado"
        : `${formatDia(fechaVencimiento(f.fecha, f.dias_credito))} (${f.dias_credito} días de crédito)`,
    ],
    ["Moneda", f.moneda],
  ];
  if (f.moneda !== "MXN")
    datos.push([
      "Tipo de cambio",
      f.tipo_cambio !== null ? String(f.tipo_cambio) : "Sin definir",
    ]);
  datos.push(
    [
      "Método de pago",
      f.metodo_pago ? etiqueta(METODOS_PAGO, f.metodo_pago) : "Sin definir",
    ],
    [
      "Forma de pago",
      f.forma_pago ? etiqueta(FORMAS_PAGO, f.forma_pago) : "Sin definir",
    ],
    ["Uso de CFDI", f.uso_cfdi ?? "Sin definir"],
    ["Orden de compra", f.orden_compra ?? "—"],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <title>{`Factura de ${razon?.razon_social ?? ""} · Sistema MOT`}</title>
      <PageHeader
        title={f.estado === "borrador" ? "Factura en borrador" : "Factura"}
        description={`${razon?.razon_social ?? ""} · ${formatDia(f.fecha)}`}
      >
        <Link
          href="/facturas"
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Facturas
        </Link>
        {edita ? (
          <Link
            href={`/facturas/${f.id}/editar`}
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            Editar
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <EstadoFacturaBadge estado={f.estado} />
        <span className="text-sm text-muted-foreground">
          Total{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatImporte(totales?.total ?? 0, f.moneda)}
          </span>{" "}
          con IVA
        </span>
      </div>

      <div className="space-y-6">
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
              {f.notas ? (
                <p className="mt-4 text-sm whitespace-pre-line text-muted-foreground">
                  {f.notas}
                </p>
              ) : null}
            </CardContent>
          </Card>
          {f.estado === "borrador" ? (
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Antes de timbrar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {faltantes.length === 0 ? (
                  <p>El borrador tiene todo lo necesario para timbrarse.</p>
                ) : (
                  <>
                    <p className="text-muted-foreground">Falta:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {faltantes.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="text-muted-foreground">
                  Por ahora la factura se timbra fuera del sistema; el registro
                  del folio fiscal llega en el siguiente paso.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Conceptos
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {conceptos.length}
            </span>
          </h2>
          {conceptos.length === 0 ? (
            <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
              El borrador se quedó sin conceptos. Elimínalo desde Editar y arma
              otro.
            </Card>
          ) : (
            <ul className="space-y-2">
              {conceptos.map((c) => (
                <li key={c.id}>
                  <Card className="gap-1 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium break-words">
                        {c.descripcion}
                      </p>
                      <p className="font-medium tabular-nums">
                        {formatImporte(c.importe ?? 0, f.moneda)}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {c.cantidad} {c.unidad ?? ""} ×{" "}
                      {formatImporte(c.precio_unitario, f.moneda)} · IVA{" "}
                      {formatImporte(c.iva ?? 0, f.moneda)} ·{" "}
                      {c.clave_prod_serv && c.clave_unidad
                        ? `SAT ${c.clave_prod_serv} / ${c.clave_unidad}`
                        : "sin claves del SAT"}
                    </p>
                    {edita ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Link
                          href={`/facturas/${f.id}/conceptos/${c.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                            className: "h-8",
                          })}
                        >
                          Descripción y claves
                        </Link>
                        <form action={quitarConcepto.bind(null, f.id, c.id)}>
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                          >
                            Quitar de la factura
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-4 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-right">
              {formatImporte(totales?.subtotal ?? 0, f.moneda)}
            </dd>
            <dt className="text-muted-foreground">IVA</dt>
            <dd className="text-right">
              {formatImporte(totales?.iva ?? 0, f.moneda)}
            </dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-medium">
              {formatImporte(totales?.total ?? 0, f.moneda)}
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
