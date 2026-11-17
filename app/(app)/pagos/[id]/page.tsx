import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import {
  aplicacionesDePago,
  facturasPorCobrar,
  obtenerPago,
} from "@/lib/facturacion/data";
import { folioFactura } from "@/lib/facturacion/facturas";
import { nombreFormaPago, requiereComplemento } from "@/lib/facturacion/pagos";
import { formatDia, formatImporte } from "@/lib/format";
import { directorioTecnicos } from "@/lib/ordenes/data";
import { aplicarPago, eliminarPago, quitarAplicacion } from "../actions";

const enlace = "text-primary underline-offset-4 hover:underline";

export default async function PagoPage({
  params,
  searchParams,
}: PageProps<"/pagos/[id]">) {
  const sesion = await requirePermiso("facturacion.ver");
  const { id } = await params;
  const { error } = await searchParams;
  const p = z.uuid().safeParse(id).success ? await obtenerPago(id) : null;
  if (!p) notFound();
  const edita = tienePermiso(sesion, "facturacion.editar");
  const [aplicaciones, { nombres }, porCobrar] = await Promise.all([
    aplicacionesDePago(p.id),
    directorioTecnicos(),
    edita && p.saldos.por_aplicar > 0 ? facturasPorCobrar(p.cuenta_id) : [],
  ]);
  const aplicadas = new Set(aplicaciones.map((a) => a.factura_id));
  // Lo que queda del pago se puede aplicar a otras facturas de la misma razón social y moneda.
  const disponibles = porCobrar.filter(
    (f) =>
      f.razon_social_id === p.razon_social_id &&
      f.moneda === p.moneda &&
      !aplicadas.has(f.id),
  );
  // Una aplicación de anticipo no es dinero nuevo: sale de una factura de anticipo.
  const esAnticipo = p.anticipo_factura_id !== null;
  const faltaComplemento =
    !esAnticipo &&
    !p.rep_uuid &&
    requiereComplemento(
      aplicaciones.map((a) => a.facturas?.metodo_pago ?? null),
    );

  const datos: [string, ReactNode][] = [
    [
      "Cliente",
      <Link key="c" href={`/clientes/${p.cuenta_id}`} className={enlace}>
        {p.cuentas?.nombre ?? "—"}
      </Link>,
    ],
    [
      "Razón social",
      p.razones_sociales
        ? `${p.razones_sociales.razon_social} · ${p.razones_sociales.rfc}`
        : "—",
    ],
    ["Fecha", formatDia(p.fecha)],
    ["Monto", formatImporte(p.monto, p.moneda)],
    ["Forma de pago", nombreFormaPago(p.forma_pago)],
  ];
  if (p.anticipo_factura_id)
    datos.push([
      "Sale del anticipo",
      <Link
        key="a"
        href={`/facturas/${p.anticipo_factura_id}`}
        className={enlace}
      >
        Ver la factura de anticipo
      </Link>,
    ]);
  else if (p.referencia) datos.push(["Referencia", p.referencia]);
  if (p.tipo_cambio !== null)
    datos.push(["Tipo de cambio del pago", String(p.tipo_cambio)]);
  datos.push([
    "Registró",
    p.created_by ? (nombres.get(p.created_by) ?? "Usuario dado de baja") : "—",
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <title>{`Pago de ${p.razones_sociales?.razon_social ?? ""} · Sistema MOT`}</title>
      <PageHeader
        title={esAnticipo ? "Aplicación de anticipo" : "Pago recibido"}
        description={`${p.razones_sociales?.razon_social ?? ""} · ${formatDia(p.fecha)}`}
      >
        <Link
          href="/pagos"
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Pagos
        </Link>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium tabular-nums">
          {formatImporte(p.monto, p.moneda)}
        </span>
        {p.saldos.por_aplicar > 0 ? (
          <Badge variant="secondary">
            Por aplicar {formatImporte(p.saldos.por_aplicar, p.moneda)}
          </Badge>
        ) : (
          <Badge variant="outline">Aplicado completo</Badge>
        )}
      </div>

      {typeof error === "string" ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Datos del pago</CardTitle>
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
              {p.notas ? (
                <p className="mt-4 text-sm whitespace-pre-line text-muted-foreground">
                  {p.notas}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>
                {esAnticipo ? "CFDI de egreso" : "Complemento de pago"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {p.rep_uuid ? (
                <>
                  <p>Folio {p.rep_folio}</p>
                  <p className="font-mono text-xs break-all">{p.rep_uuid}</p>
                </>
              ) : faltaComplemento ? (
                <p className="font-medium text-destructive">
                  Falta registrarlo: este pago cubre una factura PPD.
                </p>
              ) : esAnticipo ? (
                <p className="text-muted-foreground">
                  Al aplicar un anticipo se emite un CFDI de egreso por ese
                  monto. Por ahora se timbra fuera del sistema; registra aquí su
                  folio.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {aplicaciones.length === 0
                    ? "Se necesita cuando el pago se aplica a una factura PPD."
                    : "No se necesita: las facturas que cubre son de pago en una sola exhibición."}
                </p>
              )}
              {edita ? (
                <Link
                  href={`/pagos/${p.id}/complemento`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "h-8",
                  })}
                >
                  {esAnticipo
                    ? p.rep_uuid
                      ? "Corregir CFDI de egreso"
                      : "Registrar CFDI de egreso"
                    : p.rep_uuid
                      ? "Corregir complemento"
                      : "Registrar complemento"}
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Facturas a las que se aplicó
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {aplicaciones.length}
            </span>
          </h2>
          {aplicaciones.length === 0 ? (
            <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
              Este pago aún no se aplica a ninguna factura.
            </Card>
          ) : (
            <ul className="space-y-2">
              {aplicaciones.map((a) => (
                <li key={a.id}>
                  <Card className="gap-1 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link
                        href={`/facturas/${a.factura_id}`}
                        className={`text-sm font-medium ${enlace}`}
                      >
                        Factura {a.facturas ? folioFactura(a.facturas) : ""}
                      </Link>
                      <p className="font-medium tabular-nums">
                        {formatImporte(a.monto, p.moneda)}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {a.facturas ? formatDia(a.facturas.fecha) : ""}
                      {a.facturas?.metodo_pago
                        ? ` · ${a.facturas.metodo_pago}`
                        : ""}
                    </p>
                    {edita && !p.rep_uuid ? (
                      <form action={quitarAplicacion.bind(null, p.id, a.id)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                        >
                          Quitar de esta factura
                        </Button>
                      </form>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        {edita && p.saldos.por_aplicar > 0 && !esAnticipo ? (
          <Card>
            <CardHeader>
              <CardTitle>
                Aplicar lo que queda (
                {formatImporte(p.saldos.por_aplicar, p.moneda)})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {disponibles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta razón social no tiene más facturas por cobrar en{" "}
                  {p.moneda}. El resto queda a su favor hasta que se le emita
                  otra factura.
                </p>
              ) : (
                <form
                  action={aplicarPago.bind(null, p.id)}
                  className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
                >
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Factura
                    <NativeSelect
                      name="factura"
                      required
                      className="h-10 w-full font-normal"
                    >
                      {disponibles.map((f) => (
                        <NativeSelectOption key={f.id} value={f.id}>
                          {folioFactura(f)} · saldo{" "}
                          {formatImporte(f.saldos.saldo, f.moneda)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Monto
                    <Input
                      name="monto"
                      inputMode="decimal"
                      required
                      autoComplete="off"
                      className="h-10 font-normal"
                    />
                  </label>
                  <Button type="submit" className="h-10">
                    Aplicar
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ) : null}

        {edita && !p.rep_uuid ? (
          <form action={eliminarPago.bind(null, p.id)}>
            <Button type="submit" variant="ghost" size="sm" className="h-8">
              {esAnticipo
                ? "Deshacer esta aplicación de anticipo"
                : "Eliminar este pago (se capturó por error)"}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
