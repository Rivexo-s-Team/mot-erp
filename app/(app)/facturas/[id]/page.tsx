import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { SubirArchivoFactura } from "@/components/factura-archivos";
import { EstadoFacturaBadge } from "@/components/factura-estado-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
  anticiposDeRazon,
  aplicacionesDeAnticipo,
  pagosDeFactura,
  portalDeFacturas,
  portalDeRazon,
  saldosDeFacturas,
} from "@/lib/facturacion/data";
import { nombreEstadoPortal } from "@/lib/facturacion/cobranza";
import { totalDistinto } from "@/lib/facturacion/cfdi";
import {
  accionesFactura,
  faltantesParaTimbrar,
  folioFactura,
} from "@/lib/facturacion/facturas";
import {
  ESTADOS_COBRO,
  estadoCobro,
  nombreFormaPago,
} from "@/lib/facturacion/pagos";
import { formatDia, formatFecha, formatImporte } from "@/lib/format";
import { directorioTecnicos } from "@/lib/ordenes/data";
import { aplicarAnticipo, quitarConcepto } from "../actions";

const enlace = "text-primary underline-offset-4 hover:underline";

export default async function FacturaPage({
  params,
  searchParams,
}: PageProps<"/facturas/[id]">) {
  const sesion = await requirePermiso("facturacion.ver");
  const { id } = await params;
  const { error } = await searchParams;
  const f = z.uuid().safeParse(id).success ? await obtenerFactura(id) : null;
  if (!f) notFound();
  const [conceptos, credito, { nombres }] = await Promise.all([
    conceptosDeFactura(f.id),
    creditoDeCuenta(f.cuenta_id),
    directorioTecnicos(),
  ]);
  // Cobro: solo una factura emitida tiene saldo y pagos.
  const emitida = f.estado === "emitida";
  const [saldos, pagos] = emitida
    ? await Promise.all([saldosDeFacturas([f.id]), pagosDeFactura(f.id)])
    : [null, []];
  const saldo = saldos?.get(f.id) ?? null;
  // Anticipos de la razón social: esta factura puede ser uno, o recibir uno.
  const anticipos = emitida
    ? await anticiposDeRazon(f.razon_social_id, f.moneda)
    : [];
  const esteAnticipo = anticipos.find((a) => a.factura_id === f.id) ?? null;
  const aplicadoA = esteAnticipo ? await aplicacionesDeAnticipo(f.id) : [];
  const disponibles =
    f.es_anticipo || !saldo || saldo.saldo <= 0
      ? []
      : anticipos.filter((a) => a.disponible > 0);
  // Portal de proveedores: si la razón social lo usa o ya hay seguimiento.
  const [portales, razonPortal] = emitida
    ? await Promise.all([
        portalDeFacturas([f.id]),
        portalDeRazon(f.razon_social_id),
      ])
    : [null, null];
  const portal = portales?.get(f.id) ?? null;
  const muestraPortal = emitida && (portal !== null || razonPortal?.usa);
  const acciones = accionesFactura(f.estado);
  const puede = tienePermiso(sesion, "facturacion.editar");
  const edita = puede && acciones.editar;
  const persona = (uid: string | null) =>
    uid ? (nombres.get(uid) ?? "Usuario dado de baja") : "—";
  const folio = folioFactura(f);
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

  // Datos del timbre: solo existen cuando la factura ya se registró como emitida.
  const timbre: [string, ReactNode][] = f.uuid_fiscal
    ? [
        ["Serie y folio", folio || "—"],
        [
          "Folio fiscal",
          <span key="u" className="font-mono text-xs break-all">
            {f.uuid_fiscal}
          </span>,
        ],
        [
          "Registrada",
          `${persona(f.emitida_por)} · ${f.emitida_at ? formatFecha(f.emitida_at) : ""}${f.timbrado === "manual" ? " · timbrada fuera del sistema" : ""}`,
        ],
      ]
    : [];
  if (f.estado === "cancelada")
    timbre.push(
      [
        "Cancelada",
        `${persona(f.cancelada_por)} · ${f.cancelada_at ? formatFecha(f.cancelada_at) : ""}`,
      ],
      ["Motivo", f.motivo_cancelacion ?? "—"],
    );

  const datos: [string, ReactNode][] = [
    [
      "Cliente",
      <Link key="c" href={`/clientes/${f.cuenta_id}`} className={enlace}>
        {f.cuentas?.nombre ?? "—"}
      </Link>,
    ],
    ["Razón social", razon ? `${razon.razon_social} · ${razon.rfc}` : "—"],
    [
      f.estado === "borrador" ? "Fecha" : "Fecha de emisión",
      formatDia(f.fecha),
    ],
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
        title={
          f.estado === "borrador" ? "Factura en borrador" : `Factura ${folio}`
        }
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
        {f.es_anticipo ? <Badge variant="outline">Anticipo</Badge> : null}
        {saldo ? (
          <Badge variant={saldo.saldo <= 0 ? "exito" : "aviso"}>
            {ESTADOS_COBRO[estadoCobro(saldo)]}
            {saldo.saldo > 0
              ? ` · saldo ${formatImporte(saldo.saldo, f.moneda)}`
              : ""}
          </Badge>
        ) : null}
        {puede && acciones.emitir && conceptos.length > 0 ? (
          <Link
            href={`/facturas/${f.id}/emitir`}
            className={buttonVariants({ size: "sm", className: "h-8" })}
          >
            Registrar como emitida
          </Link>
        ) : null}
        {puede && acciones.corregirRegistro && !f.xml_ruta ? (
          <Link
            href={`/facturas/${f.id}/emitir`}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "h-8",
            })}
          >
            Corregir registro
          </Link>
        ) : null}
        {puede && acciones.cancelar ? (
          <Link
            href={`/facturas/${f.id}/cancelar`}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "h-8",
            })}
          >
            Cancelar factura
          </Link>
        ) : null}
        <span className="text-sm text-muted-foreground">
          Total{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatImporte(totales?.total ?? 0, f.moneda)}
          </span>{" "}
          con IVA
        </span>
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
              <CardTitle>Datos de la factura</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                {[...timbre, ...datos].map(([nombre, valor]) => (
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
                  Por ahora la factura se timbra fuera del sistema. Cuando ya
                  esté timbrada, regístrala aquí como emitida con su folio
                  fiscal.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Archivos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {(["xml", "pdf"] as const).map((tipo) => {
                  const ruta = tipo === "xml" ? f.xml_ruta : f.pdf_ruta;
                  return (
                    <div key={tipo}>
                      {ruta ? (
                        <a
                          href={`/archivos/factura/${f.id}/${tipo}`}
                          target="_blank"
                          rel="noreferrer"
                          className={enlace}
                        >
                          {tipo === "xml" ? "Descargar XML" : "Abrir PDF"}
                        </a>
                      ) : puede && acciones.subirArchivos ? (
                        <SubirArchivoFactura facturaId={f.id} tipo={tipo} />
                      ) : (
                        <p className="text-muted-foreground">
                          Sin {tipo.toUpperCase()}.
                        </p>
                      )}
                    </div>
                  );
                })}
                {totalDistinto(f.xml_total, totales?.total ?? null) ? (
                  <p className="font-medium text-destructive">
                    El total del XML (
                    {formatImporte(f.xml_total ?? 0, f.moneda)}) no coincide con
                    el del sistema (
                    {formatImporte(totales?.total ?? 0, f.moneda)}
                    ). Revisa cuál es el correcto.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>

        {muestraPortal ? (
          <Card>
            <CardHeader>
              <CardTitle>Portal de proveedores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {nombreEstadoPortal(portal?.estado)}
                </Badge>
                {razonPortal?.portal ? (
                  <span className="text-muted-foreground break-all">
                    {razonPortal.portal}
                  </span>
                ) : null}
              </div>
              {portal ? (
                <p className="text-muted-foreground">
                  {[
                    portal.fecha_subida
                      ? `Subida ${formatDia(portal.fecha_subida)}`
                      : null,
                    portal.fecha_aprobacion
                      ? `aprobada ${formatDia(portal.fecha_aprobacion)}`
                      : null,
                    portal.fecha_pago_programado
                      ? `pago programado ${formatDia(portal.fecha_pago_programado)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sin fechas todavía."}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Este cliente pide subir sus facturas a su portal. Aún no se
                  registra el seguimiento de esta.
                </p>
              )}
              {portal?.notas ? (
                <p className="whitespace-pre-line">{portal.notas}</p>
              ) : null}
              {puede ? (
                <Link
                  href={`/facturas/${f.id}/portal`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "h-8",
                  })}
                >
                  Actualizar seguimiento
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : puede && emitida ? (
          <p className="text-sm text-muted-foreground">
            ¿Esta factura se sube a un portal de proveedores?{" "}
            <Link href={`/facturas/${f.id}/portal`} className={enlace}>
              Registrar seguimiento
            </Link>
          </p>
        ) : null}

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
            {saldo ? (
              <>
                <dt className="text-muted-foreground">Pagado</dt>
                <dd className="text-right">
                  {formatImporte(saldo.pagado, f.moneda)}
                </dd>
                <dt className="font-medium">Saldo</dt>
                <dd className="text-right font-medium">
                  {formatImporte(saldo.saldo, f.moneda)}
                </dd>
              </>
            ) : null}
          </dl>
        </section>

        {emitida ? (
          <section>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                Pagos
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {pagos.length}
                </span>
              </h2>
              {puede && saldo && saldo.saldo > 0 ? (
                <Link
                  href={`/pagos/nuevo?cuenta=${f.cuenta_id}`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "h-8",
                  })}
                >
                  Registrar pago
                </Link>
              ) : null}
            </div>
            {pagos.length === 0 ? (
              <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aún no se le aplica ningún pago.
              </Card>
            ) : (
              <ul className="space-y-2">
                {pagos.map((a) => (
                  <li key={a.id}>
                    <Link href={`/pagos/${a.pago_id}`} className="block">
                      <Card className="gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-medium">
                            Pago del {a.pagos ? formatDia(a.pagos.fecha) : ""}
                          </p>
                          <p className="font-medium tabular-nums">
                            {formatImporte(a.monto, f.moneda)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {a.pagos?.forma_pago
                            ? nombreFormaPago(a.pagos.forma_pago)
                            : ""}
                          {a.pagos?.referencia
                            ? ` · ${a.pagos.referencia}`
                            : ""}
                          {a.pagos?.rep_folio
                            ? ` · complemento ${a.pagos.rep_folio}`
                            : ""}
                        </p>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {disponibles.length > 0 && puede ? (
          <Card>
            <CardHeader>
              <CardTitle>Aplicar un anticipo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Esta razón social tiene anticipo pagado sin aplicar. Lo que
                apliques baja el saldo de esta factura y queda como un pago con
                forma “30 · Aplicación de anticipos”.
              </p>
              <form
                action={aplicarAnticipo.bind(null, f.id)}
                className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
              >
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Anticipo
                  <NativeSelect
                    name="anticipo"
                    required
                    className="h-10 w-full font-normal"
                  >
                    {disponibles.map((a) => (
                      <NativeSelectOption
                        key={a.factura_id}
                        value={a.factura_id}
                      >
                        Factura {folioFactura(a)} · disponible{" "}
                        {formatImporte(a.disponible, f.moneda)}
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
            </CardContent>
          </Card>
        ) : null}

        {esteAnticipo ? (
          <section>
            <h2 className="mb-1 text-lg font-semibold tracking-tight">
              Uso del anticipo
            </h2>
            <p className="mb-3 text-sm tabular-nums">
              <span className="text-muted-foreground">Pagado </span>
              {formatImporte(esteAnticipo.pagado, f.moneda)}
              <span className="text-muted-foreground"> · aplicado </span>
              {formatImporte(esteAnticipo.aplicado, f.moneda)}
              <span className="text-muted-foreground"> · disponible </span>
              <span className="font-medium">
                {formatImporte(esteAnticipo.disponible, f.moneda)}
              </span>
            </p>
            {aplicadoA.length === 0 ? (
              <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aún no se aplica a ninguna factura. Solo se puede aplicar lo que
                el cliente ya pagó; se hace desde la factura que lo recibe.
              </Card>
            ) : (
              <ul className="space-y-2">
                {aplicadoA.map((a) => (
                  <li key={a.id}>
                    <Link href={`/pagos/${a.id}`} className="block">
                      <Card className="gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-medium">
                            Aplicado a la factura{" "}
                            {a.pago_aplicaciones
                              .map((x) =>
                                x.facturas ? folioFactura(x.facturas) : "",
                              )
                              .join(", ")}
                          </p>
                          <p className="font-medium tabular-nums">
                            {formatImporte(a.monto, f.moneda)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDia(a.fecha)}
                          {a.rep_folio
                            ? ` · CFDI de egreso ${a.rep_folio}`
                            : ""}
                        </p>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
