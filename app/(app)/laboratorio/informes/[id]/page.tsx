import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { InformeAccion } from "@/components/informe-acciones";
import { InformeGraficas } from "@/components/informe-graficas";
import { InformeTendencias } from "@/components/informe-tendencias";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia, formatFecha } from "@/lib/format";
import { contenidoDeInforme, obtenerInforme } from "@/lib/laboratorio/data";
import { CONDICIONES } from "@/lib/laboratorio/evaluacion";
import { seriesDeTendencia } from "@/lib/laboratorio/graficas";
import { accionesInforme } from "@/lib/laboratorio/informe";
import { directorioTecnicos } from "@/lib/ordenes/data";

const enlace = "text-primary underline-offset-4 hover:underline";

export default async function InformePage({
  params,
}: PageProps<"/laboratorio/informes/[id]">) {
  const sesion = await requirePermiso("laboratorio.ver");
  const { id } = await params;
  const informe = z.uuid().safeParse(id).success
    ? await obtenerInforme(id)
    : null;
  if (!informe) notFound();

  const [contenido, { nombres }] = await Promise.all([
    contenidoDeInforme(informe),
    directorioTecnicos(),
  ]);
  const graficas = seriesDeTendencia(contenido);
  const acciones = accionesInforme(informe.estado);
  const edita = tienePermiso(sesion, "laboratorio.editar");
  const valida = tienePermiso(sesion, "laboratorio.validar");
  const validado = informe.estado === "validado";
  const aceite = informe.equipos_cliente?.aceites;
  const persona = (uid: string | null) =>
    uid ? (nombres.get(uid) ?? "Usuario dado de baja") : "—";

  const datos: [string, ReactNode][] = [
    [
      "Cliente",
      tienePermiso(sesion, "clientes.ver") ? (
        <Link href={`/clientes/${informe.cuenta_id}`} className={enlace}>
          {informe.cuentas?.nombre ?? "—"}
        </Link>
      ) : (
        (informe.cuentas?.nombre ?? "—")
      ),
    ],
    ["Planta", informe.plantas?.nombre ?? "—"],
    [
      "Equipo",
      informe.equipos_cliente ? nombreEquipo(informe.equipos_cliente) : "—",
    ],
    [
      "Aceite",
      aceite
        ? `${aceite.marca} ${aceite.nombre_comercial}`
        : "Sin aceite registrado en el equipo",
    ],
    ["Fecha de emisión", formatDia(informe.fecha_emision)],
    ["Elaboró", persona(informe.elaboro_id)],
    [
      "Validó",
      validado && informe.validado_at
        ? `${persona(informe.valido_id)} · ${formatFecha(informe.validado_at)}`
        : "Aún sin validar",
    ],
  ];

  return (
    <>
      <title>{`Informe ${informe.folio} · Sistema MOT`}</title>
      <PageHeader
        title={`Informe ${informe.folio}`}
        description={`${informe.cuentas?.nombre ?? ""}${informe.equipos_cliente ? ` · ${nombreEquipo(informe.equipos_cliente)}` : ""}`}
      >
        {contenido.muestras.length > 0 ? (
          <a
            href={`/laboratorio/informes/${informe.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            PDF
          </a>
        ) : null}
        {edita && acciones.editar ? (
          <Link
            href={`/laboratorio/informes/${informe.id}/editar`}
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            Editar
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={validado ? "outline" : "secondary"}>
          {validado ? "Validado" : "Borrador"}
        </Badge>
        {contenido.condicionGeneral ? (
          <Badge
            variant={
              contenido.condicionGeneral === "critico"
                ? "destructive"
                : contenido.condicionGeneral === "precaucion"
                  ? "secondary"
                  : "outline"
            }
          >
            Condición general: {CONDICIONES[contenido.condicionGeneral]}
          </Badge>
        ) : null}
        {valida && acciones.validar && contenido.muestras.length > 0 ? (
          <InformeAccion informeId={informe.id} accion="validar" />
        ) : null}
        {valida && acciones.reabrir ? (
          <InformeAccion informeId={informe.id} accion="reabrir" />
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Datos del informe</CardTitle>
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
              <CardTitle>Observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-sm whitespace-pre-line ${informe.observaciones ? "" : "text-muted-foreground"}`}
              >
                {informe.observaciones ??
                  "Sin observaciones. Se escriben en Editar."}
              </p>
            </CardContent>
          </Card>
        </div>

        <section>
          <h2 className="mb-1 text-lg font-semibold tracking-tight">
            Tendencias
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {contenido.muestras.length}{" "}
              {contenido.muestras.length === 1 ? "muestra" : "muestras"}
            </span>
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {validado
              ? "Es la copia que quedó fija al validar. En rojo, lo que no pasa."
              : "En borrador se calcula con los resultados y límites de este momento; al validar queda fijo. En rojo, lo que no pasa."}
          </p>
          {contenido.muestras.length === 0 ? (
            <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
              El informe no tiene muestras. Agrégalas en Editar.
            </Card>
          ) : (
            <InformeTendencias contenido={contenido} />
          )}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {contenido.muestras.map((m) => (
              <li key={m.id}>
                <Link href={`/laboratorio/muestras/${m.id}`} className={enlace}>
                  Muestra {m.idMuestra}
                </Link>
                {m.notas ? (
                  <span className="text-muted-foreground"> · {m.notas}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {graficas.length > 0 ? (
          <section>
            <h2 className="mb-1 text-lg font-semibold tracking-tight">
              Gráficas de tendencia
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Una por parámetro, de la muestra más antigua a la más reciente.
              Toca o pasa el cursor por un punto para ver su valor; los puntos
              huecos en rojo no pasan.
            </p>
            <InformeGraficas
              grupos={graficas}
              muestras={contenido.muestras.map((m) => ({
                idMuestra: m.idMuestra,
                fecha: m.fecha,
              }))}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
