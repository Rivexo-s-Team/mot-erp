import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EstadoContratoBadge } from "@/components/contrato-estado-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import {
  etiqueta,
  textoVigencia,
  TIPOS_CONTRATO,
  UNIDADES_TARIFA,
} from "@/lib/contratos/campos";
import {
  ampliacionesDe,
  nombreContrato,
  obtenerContrato,
  tarifasDeContrato,
  totalesDeContratos,
} from "@/lib/contratos/data";
import { formatDia, formatFecha, formatImporte } from "@/lib/format";

const enlace = "text-primary underline-offset-4 hover:underline";

export default async function ContratoPage({
  params,
  searchParams,
}: PageProps<"/contratos/[id]">) {
  const sesion = await requirePermiso("contratos.ver");
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const c = await obtenerContrato(id);
  if (!c) notFound();

  const edita = tienePermiso(sesion, "contratos.editar");
  // Las tarifas son precios: solo para quien puede verlos.
  const vePrecios = tienePermiso(sesion, "precios.ver");
  const [origen, ampliaciones, tarifas, totales] = await Promise.all([
    c.contrato_origen_id ? obtenerContrato(c.contrato_origen_id) : null,
    ampliacionesDe(c.id),
    vePrecios ? tarifasDeContrato(c.id) : [],
    vePrecios ? totalesDeContratos([c.id]) : new Map(),
  ]);
  const total = totales.get(c.id);
  const titulo = `${c.cuentas.nombre} · ${nombreContrato(c)}`;

  const datos: [string, React.ReactNode][] = [
    [
      "Cliente",
      <Link key="c" href={`/clientes/${c.cuenta_id}`} className={enlace}>
        {c.cuentas.nombre}
      </Link>,
    ],
    ["Planta", c.plantas?.nombre ?? "—"],
    ["Tipo", etiqueta(TIPOS_CONTRATO, c.tipo)],
    [
      "Razón social a facturar",
      c.razones_sociales
        ? `${c.razones_sociales.razon_social} (${c.razones_sociales.rfc})`
        : "Sin definir",
    ],
    ["Referencia", c.referencia ?? "—"],
    ["Vigencia", textoVigencia(c.fecha_inicio, c.fecha_termino, formatDia)],
    ["Moneda", c.moneda],
    ["Incluye filtros", c.incluye_filtros ? "Sí" : "No"],
    ["Incluye laboratorio", c.incluye_laboratorio ? "Sí" : "No"],
    ["Frecuencia de visitas", c.frecuencia_visitas ?? "—"],
  ];
  if (origen) {
    datos.push([
      "Es ampliación de",
      <Link key="o" href={`/contratos/${origen.id}`} className={enlace}>
        {nombreContrato(origen)}
        {origen.referencia ? ` · ${origen.referencia}` : ""}
      </Link>,
    ]);
  }
  if (c.oportunidad_id && tienePermiso(sesion, "oportunidades.ver")) {
    datos.push([
      "Oportunidad",
      <Link
        key="op"
        href={`/oportunidades/${c.oportunidad_id}`}
        className={enlace}
      >
        Ver la oportunidad ganada
      </Link>,
    ]);
  }
  datos.push(["Último cambio", formatFecha(c.updated_at)]);

  return (
    <>
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader title={nombreContrato(c)} description={c.cuentas.nombre}>
        <Link
          href="/contratos"
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Contratos
        </Link>
        {edita ? (
          <Link
            href={`/contratos/${c.id}/editar`}
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            Editar
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <EstadoContratoBadge estado={c.estado} />
        {c.contrato_origen_id ? (
          <Badge variant="secondary">Ampliación</Badge>
        ) : null}
      </div>

      {aviso === "tarifas" ? (
        <Card className="mb-6 border-destructive/40 px-4 py-3 text-sm">
          El contrato se creó, pero no se pudieron copiar las partidas de la
          cotización. Captura las tarifas a mano.
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Datos del contrato</CardTitle>
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
            {c.notas ? (
              <p className="mt-4 text-sm whitespace-pre-line text-muted-foreground">
                {c.notas}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {vePrecios ? (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  Tarifas
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {tarifas.length}
                  </span>
                </h2>
                {edita ? (
                  <Link
                    href={`/contratos/${c.id}/tarifas/nueva`}
                    className={buttonVariants({
                      variant: "outline",
                      className: "h-9",
                    })}
                  >
                    Agregar tarifa
                  </Link>
                ) : null}
              </div>
              {tarifas.length === 0 ? (
                <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Aún no hay tarifas. En una renta va una por cada Robox, con su
                  precio mensual.
                </Card>
              ) : (
                <ul className="space-y-2">
                  {tarifas.map((t) => {
                    const tarjeta = (
                      <Card
                        className={`gap-1 px-4 py-3 ${edita ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <p className="font-medium break-words">
                            {t.concepto}
                          </p>
                          <p className="font-medium tabular-nums">
                            {formatImporte(t.precio, c.moneda)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {etiqueta(UNIDADES_TARIFA, t.unidad)}
                          {t.equipos_cliente
                            ? ` · Equipo ${t.equipos_cliente.identificador}${t.equipos_cliente.alias ? ` (${t.equipos_cliente.alias})` : ""}`
                            : ""}
                        </p>
                        {t.notas ? (
                          <p className="text-sm whitespace-pre-line">
                            {t.notas}
                          </p>
                        ) : null}
                      </Card>
                    );
                    return (
                      <li key={t.id}>
                        {edita ? (
                          <Link
                            href={`/contratos/${c.id}/tarifas/${t.id}`}
                            className="block"
                          >
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
              {total && tarifas.length > 0 ? (
                <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 px-4 text-sm tabular-nums">
                  <dt className="text-muted-foreground">Total al mes</dt>
                  <dd className="text-right font-medium">
                    {formatImporte(total.total_mensual, c.moneda)}
                  </dd>
                  {Number(total.total_unico) > 0 ? (
                    <>
                      <dt className="text-muted-foreground">Pagos únicos</dt>
                      <dd className="text-right font-medium">
                        {formatImporte(total.total_unico, c.moneda)}
                      </dd>
                    </>
                  ) : null}
                  <dt className="col-span-2 text-xs text-muted-foreground">
                    Precios sin IVA.
                  </dt>
                </dl>
              ) : null}
            </section>
          ) : null}

          {ampliaciones.length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">
                Ampliaciones
              </h2>
              <ul className="space-y-2">
                {ampliaciones.map((a) => (
                  <li key={a.id}>
                    <Link href={`/contratos/${a.id}`} className="block">
                      <Card className="flex-row flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                        <p className="font-medium">{nombreContrato(a)}</p>
                        <EstadoContratoBadge estado={a.estado} />
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
