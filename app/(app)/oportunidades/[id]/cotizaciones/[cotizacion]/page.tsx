import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ESTADOS,
  etiqueta,
  FUENTES,
  UNIDADES,
} from "@/lib/cotizaciones/campos";
import { formatDia, formatFecha, formatImporte } from "@/lib/format";
import {
  crearNuevaVersion,
  marcarEnviada,
} from "../../../cotizaciones-actions";
import { cargarCotizacion } from "./contexto";

export default async function CotizacionPage({
  params,
}: PageProps<"/oportunidades/[id]/cotizaciones/[cotizacion]">) {
  const { id, cotizacion: cotizacionId } = await params;
  const {
    oportunidad,
    cotizacion: c,
    editable,
    puedeEditar,
  } = await cargarCotizacion(id, cotizacionId);
  const base = `/oportunidades/${id}/cotizaciones/${c.id}`;
  const importe = (n: number) => formatImporte(n, c.moneda);

  const datos: [string, string][] = [
    ["Cliente", oportunidad.cuentas.nombre],
    [
      "Moneda",
      c.tipo_cambio !== null
        ? `${c.moneda} (tipo de cambio ${c.tipo_cambio})`
        : c.moneda,
    ],
    ["Creada", formatFecha(c.created_at)],
    ["Vigente hasta", c.vigencia ? formatDia(c.vigencia) : "—"],
  ];
  if (c.valor_total_contrato !== null) {
    datos.push(["Valor total del contrato", importe(c.valor_total_contrato)]);
  }
  if (c.litros_estimados !== null)
    datos.push(["Litros estimados", `${c.litros_estimados} L`]);

  return (
    <>
      <title>{`Cotización v${c.version} · ${oportunidad.nombre} · Sistema MOT`}</title>
      <PageHeader
        title={`Cotización versión ${c.version}`}
        description={oportunidad.nombre}
      >
        <Link
          href={`/oportunidades/${id}`}
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Oportunidad
        </Link>
        {editable ? (
          <Link
            href={`${base}/editar`}
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            Editar datos
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={c.estado === "enviada" ? "default" : "secondary"}>
          {etiqueta(ESTADOS, c.estado)}
        </Badge>
        {c.estado === "enviada" ? (
          <span className="text-sm text-muted-foreground">
            Ya no se puede editar. Para cambiarla, crea una versión nueva.
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Partidas
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {c.lineas.length}
              </span>
            </h2>
            {editable ? (
              <Link
                href={`${base}/partidas/nueva`}
                className={buttonVariants({ className: "h-9" })}
              >
                Agregar partida
              </Link>
            ) : null}
          </div>

          {c.lineas.length === 0 ? (
            <Card className="px-4 py-8 text-center text-sm text-muted-foreground">
              Esta cotización aún no tiene partidas.
            </Card>
          ) : (
            <ul className="space-y-2">
              {c.lineas.map((l) => {
                const tarjeta = (
                  <Card
                    className={`gap-1 px-4 py-3 ${editable ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <p className="font-medium">{l.concepto}</p>
                      <p className="font-medium tabular-nums">
                        {importe(l.importe ?? 0)}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {l.cantidad} {etiqueta(UNIDADES, l.unidad).toLowerCase()}
                      {l.cantidad === 1
                        ? ""
                        : l.unidad === "mes"
                          ? "es"
                          : "s"}{" "}
                      × {importe(l.precio_unitario)}
                      {l.equipos_cliente
                        ? ` · ${l.equipos_cliente.identificador}${l.equipos_cliente.alias ? ` (${l.equipos_cliente.alias})` : ""}`
                        : ""}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <Badge variant="outline">
                        {l.recurrente ? "Recurrente" : "Una sola vez"}
                      </Badge>
                      {l.precio_referencia !== null ? (
                        <Badge variant="outline">
                          Aceite nuevo: {importe(l.precio_referencia)} ·{" "}
                          {etiqueta(FUENTES, l.fuente_tipo).toLowerCase()}
                          {l.fecha_referencia
                            ? ` · ${formatDia(l.fecha_referencia)}`
                            : ""}
                        </Badge>
                      ) : null}
                    </div>
                  </Card>
                );
                return (
                  <li key={l.id}>
                    {editable ? (
                      <Link href={`${base}/partidas/${l.id}`} className="block">
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

          {c.condiciones ? (
            <div className="mt-6">
              <h2 className="mb-2 text-lg font-semibold tracking-tight">
                Condiciones comerciales
              </h2>
              <p className="text-sm whitespace-pre-line">{c.condiciones}</p>
            </div>
          ) : null}
          {c.notas ? (
            <div className="mt-6">
              <h2 className="mb-2 text-lg font-semibold tracking-tight">
                Notas internas
              </h2>
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {c.notas}
              </p>
            </div>
          ) : null}
        </section>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Una sola vez</dt>
                <dd className="text-right font-medium tabular-nums">
                  {importe(c.totales.total_unico)}
                </dd>
                <dt className="text-muted-foreground">
                  Recurrente (por periodo)
                </dt>
                <dd className="text-right font-medium tabular-nums">
                  {importe(c.totales.total_recurrente)}
                </dd>
              </dl>
              {/* PENDIENTE(P8): falta confirmar con MOT si la cotización muestra IVA. */}
              <p className="mt-3 text-xs text-muted-foreground">
                Importes sin IVA.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {datos.map(([titulo, valor]) => (
                  <div key={titulo} className="contents">
                    <dt className="text-muted-foreground">{titulo}</dt>
                    <dd>{valor}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {puedeEditar ? (
            <div className="flex flex-col gap-2">
              {editable ? (
                <form action={marcarEnviada.bind(null, id, c.id)}>
                  <Button
                    type="submit"
                    className="h-10 w-full"
                    disabled={c.lineas.length === 0}
                  >
                    Marcar como enviada
                  </Button>
                </form>
              ) : null}
              <form action={crearNuevaVersion.bind(null, id, c.id)}>
                <Button type="submit" variant="outline" className="h-10 w-full">
                  Crear versión nueva a partir de esta
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
