import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EstadoRoboxBadge } from "@/components/flota-estado-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import {
  etiqueta,
  textoVigencia,
  TIPOS_CONTRATO,
} from "@/lib/contratos/campos";
import { MOVIDO_POR, nombreEquipo } from "@/lib/flota/campos";
import {
  asignacionesDeRobox,
  filtrosDeRobox,
  mesesCambioFiltro,
  carruselDeAsignacion,
  movimientosDeAsignacion,
  obtenerRobox,
  recomendacionesDeLaboratorio,
  ubicaciones,
  ultimasLecturasDeFiltro,
} from "@/lib/flota/data";
import {
  estadoFiltro,
  lecturaAgotada,
  lecturaVigente,
  recomendacionVigente,
} from "@/lib/flota/filtros";
import { formatDia, formatFecha, hoyEnMexico } from "@/lib/format";
import { deshacerUltimoMovimiento } from "../asignaciones-actions";

const enlace = "text-primary underline-offset-4 hover:underline";
const botonChico = buttonVariants({ variant: "outline", className: "h-9" });

export default async function RoboxPage({ params }: PageProps<"/flota/[id]">) {
  const sesion = await requirePermiso("flota.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const robox = await obtenerRobox(id);
  if (!robox) notFound();

  const edita = tienePermiso(sesion, "flota.editar");
  const veContratos = tienePermiso(sesion, "contratos.ver");
  const [ubicacion, asignaciones, filtros, lecturas, meses, delLaboratorio] =
    await Promise.all([
      ubicaciones({ roboxIds: [robox.id] }),
      asignacionesDeRobox(robox.id),
      filtrosDeRobox(robox.id),
      ultimasLecturasDeFiltro([robox.id]),
      mesesCambioFiltro(),
      recomendacionesDeLaboratorio([robox.id]),
    ]);
  const hoy = hoyEnMexico();
  const instalados = filtros.filter((f) => f.fecha_retiro === null);
  const retirados = filtros.filter((f) => f.fecha_retiro !== null);
  const lectura = lecturas.get(robox.id);
  // Una lectura anterior al filtro que está puesto ya no dice nada de él.
  const agotado =
    lecturaVigente(
      lectura,
      instalados.map((f) => ({ fechaInstalacion: f.fecha_instalacion })),
    ) && lecturaAgotada(lectura);
  // Lo que el laboratorio recomendó y aún no se atiende con un filtro nuevo.
  const recomendaciones = (delLaboratorio.get(robox.id) ?? []).filter((r) =>
    recomendacionVigente(
      r,
      instalados.map((f) => ({ fechaInstalacion: f.fecha_instalacion })),
    ),
  );
  // La ubicación se calcula de la asignación activa y el último movimiento.
  const actual = ubicacion.get(robox.id);
  const [carrusel, movimientos] = actual
    ? await Promise.all([
        carruselDeAsignacion(actual.asignacionId),
        movimientosDeAsignacion(actual.asignacionId),
      ])
    : [[], []];
  const anteriores = asignaciones.filter((a) => a.id !== actual?.asignacionId);
  const base = `/flota/${robox.id}`;
  const baseAsignacion = actual
    ? `${base}/asignacion/${actual.asignacionId}`
    : "";

  const datos: [string, string][] = [
    ["Número de serie", robox.numero_serie],
    ["Modelo", robox.modelo ?? "—"],
    ["Versión de programa", robox.version_programa ?? "—"],
    ["SIM", robox.sim ?? "—"],
    ["Fecha de alta", robox.fecha_alta ? formatDia(robox.fecha_alta) : "—"],
    ["Último cambio", formatFecha(robox.updated_at)],
  ];

  return (
    <>
      <title>{`Robox ${robox.numero_serie} · Sistema MOT`}</title>
      <PageHeader
        title={`Robox ${robox.numero_serie}`}
        description="SKF RecondOil Box"
      >
        <Link href="/flota" className={botonChico}>
          Flota
        </Link>
        {edita ? (
          <Link href={`${base}/editar`} className={botonChico}>
            Editar
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-6">
        <EstadoRoboxBadge estado={robox.estado} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ubicación actual</CardTitle>
            </CardHeader>
            <CardContent>
              {actual ? (
                <>
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                    <dt className="text-muted-foreground">Cliente</dt>
                    <dd>
                      <Link
                        href={`/clientes/${actual.cuentaId}`}
                        className={enlace}
                      >
                        {actual.cuenta}
                      </Link>
                    </dd>
                    <dt className="text-muted-foreground">Planta</dt>
                    <dd>{actual.planta}</dd>
                    <dt className="text-muted-foreground">Tanque</dt>
                    <dd>{actual.tanque ?? "Sin definir"}</dd>
                    <dt className="text-muted-foreground">Desde</dt>
                    <dd>{formatDia(actual.fechaInicio)}</dd>
                    {veContratos ? (
                      <>
                        <dt className="text-muted-foreground">Contrato</dt>
                        <dd>
                          <Link
                            href={`/contratos/${actual.contratoId}`}
                            className={enlace}
                          >
                            Ver contrato
                          </Link>
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {edita ? (
                    <div className="mt-4">
                      <Link href={baseAsignacion} className={botonChico}>
                        Editar o terminar asignación
                      </Link>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {robox.estado === "baja"
                      ? "Este Robox está dado de baja."
                      : "No está asignado a ningún contrato."}
                  </p>
                  {edita && robox.estado !== "baja" ? (
                    <Link
                      href={`${base}/asignar`}
                      className={buttonVariants({ className: "h-9" })}
                    >
                      Asignar a un contrato
                    </Link>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {instalados.length === 0 ? (
                <p className="text-muted-foreground">
                  No se ha registrado qué filtro tiene este Robox.
                </p>
              ) : (
                <ul className="space-y-2">
                  {instalados.map((f) => {
                    const e =
                      meses === null
                        ? null
                        : estadoFiltro({
                            fechaInstalacion: f.fecha_instalacion,
                            meses,
                            hoy,
                          });
                    const fila = (
                      <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2">
                        <div>
                          <p className="font-medium">
                            {f.partes?.nombre ?? "Filtro"}
                          </p>
                          <p className="text-muted-foreground">
                            Instalado el {formatDia(f.fecha_instalacion)}
                            {e
                              ? ` · toca cambiarlo el ${formatDia(e.vence)}`
                              : ""}
                          </p>
                        </div>
                        {e?.vencido ? (
                          <Badge variant="destructive">Cambio vencido</Badge>
                        ) : null}
                      </div>
                    );
                    return (
                      <li key={f.id}>
                        {edita ? (
                          <Link
                            href={`${base}/filtros/${f.id}`}
                            className="block transition-colors hover:bg-accent/40"
                          >
                            {fila}
                          </Link>
                        ) : (
                          fila
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {lectura ? (
                <p
                  className={
                    agotado
                      ? "font-medium text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  Última lectura ({formatDia(lectura.fecha)}): filtro usado{" "}
                  {lectura.usados}
                  {lectura.vida !== null ? ` de ${lectura.vida}` : ""} días.
                  {agotado ? " La pantalla ya lo marca agotado." : ""}
                </p>
              ) : null}
              {recomendaciones.map((r) => (
                <p key={r.folio} className="font-medium text-destructive">
                  El laboratorio recomienda cambiar el filtro: informe {r.folio}
                  , equipo {r.equipo}, validado el {formatDia(r.fecha)}.
                </p>
              ))}
              {retirados.length > 0 ? (
                <details>
                  <summary className="cursor-pointer text-muted-foreground">
                    Filtros anteriores ({retirados.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {retirados.map((f) => (
                      <li key={f.id}>
                        {edita ? (
                          <Link
                            href={`${base}/filtros/${f.id}`}
                            className={enlace}
                          >
                            {f.partes?.nombre ?? "Filtro"}
                          </Link>
                        ) : (
                          (f.partes?.nombre ?? "Filtro")
                        )}
                        : {formatDia(f.fecha_instalacion)} al{" "}
                        {f.fecha_retiro ? formatDia(f.fecha_retiro) : "—"}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {edita ? (
                <Link href={`${base}/filtros/nuevo`} className={botonChico}>
                  Registrar filtro instalado
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos del equipo</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                {datos.map(([titulo, valor]) => (
                  <div key={titulo} className="contents">
                    <dt className="text-muted-foreground">{titulo}</dt>
                    <dd className="break-words tabular-nums">{valor}</dd>
                  </div>
                ))}
              </dl>
              {robox.notas ? (
                <p className="mt-4 text-sm whitespace-pre-line text-muted-foreground">
                  {robox.notas}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {actual ? (
            <>
              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Carrusel
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {carrusel.length}
                    </span>
                  </h2>
                  {edita ? (
                    <Link
                      href={`${baseAsignacion}/carrusel/nuevo`}
                      className={botonChico}
                    >
                      Agregar tanque
                    </Link>
                  ) : null}
                </div>
                {carrusel.length === 0 ? (
                  <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Aún no se indica qué tanques atiende. Agrega uno o varios;
                    si son varios, el Robox rota entre ellos.
                  </Card>
                ) : (
                  <ul className="space-y-2">
                    {carrusel.map((k) => {
                      const aqui = k.equipo_cliente_id === actual.tanqueId;
                      const tarjeta = (
                        <Card
                          className={`flex-row flex-wrap items-center justify-between gap-2 px-4 py-3 ${edita ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""}`}
                        >
                          <div>
                            <p className="font-medium">
                              {k.equipos_cliente
                                ? nombreEquipo(k.equipos_cliente)
                                : "—"}
                            </p>
                            {k.id_caso ? (
                              <p className="text-sm text-muted-foreground">
                                ID de caso {k.id_caso}
                              </p>
                            ) : null}
                          </div>
                          {aqui ? <Badge>Aquí está</Badge> : null}
                        </Card>
                      );
                      return (
                        <li key={k.id}>
                          {edita ? (
                            <Link
                              href={`${baseAsignacion}/carrusel/${k.id}`}
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
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Movimientos
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {movimientos.length}
                    </span>
                  </h2>
                  {edita && carrusel.length > 0 ? (
                    <Link
                      href={`${baseAsignacion}/movimiento`}
                      className={botonChico}
                    >
                      Registrar movimiento
                    </Link>
                  ) : null}
                </div>
                {movimientos.length === 0 ? (
                  <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Sin movimientos. Registra uno cada vez que el Robox se
                    instale o pase de un tanque a otro.
                  </Card>
                ) : (
                  <ul className="space-y-2">
                    {movimientos.map((m, i) => (
                      <li key={m.id}>
                        <Card className="gap-1 px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">
                              {m.origen
                                ? `${m.origen} → ${m.destino}`
                                : `Instalado en ${m.destino}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDia(m.fecha)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm text-muted-foreground">
                              Lo movió {etiqueta(MOVIDO_POR, m.movido_por)}
                            </p>
                            {edita && i === 0 ? (
                              <form
                                action={deshacerUltimoMovimiento.bind(
                                  null,
                                  robox.id,
                                  actual.asignacionId,
                                )}
                              >
                                <Button type="submit" variant="ghost" size="sm">
                                  Deshacer
                                </Button>
                              </form>
                            ) : null}
                          </div>
                          {m.notas ? (
                            <p className="text-sm whitespace-pre-line">
                              {m.notas}
                            </p>
                          ) : null}
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}

          {anteriores.length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">
                Asignaciones anteriores
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {anteriores.length}
                </span>
              </h2>
              <ul className="space-y-2">
                {anteriores.map((a) => {
                  const tarjeta = (
                    <Card
                      className={`gap-1 px-4 py-3 ${edita ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""}`}
                    >
                      <p className="font-medium">
                        {a.contratos.cuentas.nombre} ·{" "}
                        {a.contratos.plantas?.nombre ?? "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {etiqueta(TIPOS_CONTRATO, a.contratos.tipo)} ·{" "}
                        {textoVigencia(a.fecha_inicio, a.fecha_fin, formatDia)}
                      </p>
                    </Card>
                  );
                  return (
                    <li key={a.id}>
                      {edita ? (
                        <Link
                          href={`${base}/asignacion/${a.id}`}
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
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
