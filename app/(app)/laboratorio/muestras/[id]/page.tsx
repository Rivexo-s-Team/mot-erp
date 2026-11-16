import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { EstadoMuestraBadge } from "@/components/muestra-estado-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia } from "@/lib/format";
import { obtenerMuestra } from "@/lib/laboratorio/data";
import {
  accionesMuestra,
  etiqueta,
  NIVELES_ANALISIS,
  TIPOS_MUESTRA,
  TOMADA_POR,
} from "@/lib/laboratorio/muestras";
import { recibirMuestra } from "../actions";

const enlace = "text-primary underline-offset-4 hover:underline";

export default async function MuestraPage({
  params,
}: PageProps<"/laboratorio/muestras/[id]">) {
  const sesion = await requirePermiso("laboratorio.ver");
  const { id } = await params;
  const m = z.uuid().safeParse(id).success ? await obtenerMuestra(id) : null;
  if (!m) notFound();
  const edita = tienePermiso(sesion, "laboratorio.editar");
  const aceite = m.equipos_cliente?.aceites;

  const datos: [string, ReactNode][] = [
    [
      "Cliente",
      tienePermiso(sesion, "clientes.ver") ? (
        <Link href={`/clientes/${m.cuenta_id}`} className={enlace}>
          {m.cuentas?.nombre ?? "—"}
        </Link>
      ) : (
        (m.cuentas?.nombre ?? "—")
      ),
    ],
    ["Planta", m.plantas?.nombre ?? "—"],
    ["Equipo", m.equipos_cliente ? nombreEquipo(m.equipos_cliente) : "—"],
    [
      "Aceite",
      aceite
        ? `${aceite.marca} ${aceite.nombre_comercial}`
        : "Sin aceite registrado en el equipo",
    ],
    ["Tipo de muestra", etiqueta(TIPOS_MUESTRA, m.tipo)],
    ["La tomó", etiqueta(TOMADA_POR, m.tomada_por)],
    ["Fecha de muestreo", formatDia(m.fecha_muestreo)],
    [
      "Recepción en laboratorio",
      m.fecha_recepcion ? formatDia(m.fecha_recepcion) : "Aún no se recibe",
    ],
    [
      "Nivel de análisis",
      m.nivel_analisis
        ? etiqueta(NIVELES_ANALISIS, m.nivel_analisis)
        : "Sin definir",
    ],
  ];
  if (m.id_caso) datos.push(["ID de caso", m.id_caso]);
  if (m.punto_muestreo) datos.push(["Punto de muestreo", m.punto_muestreo]);
  if (m.condicion_operacion)
    datos.push(["Condición de operación", m.condicion_operacion]);
  if (m.orden_id && m.ordenes_servicio)
    datos.push([
      "Orden de servicio",
      <Link key="o" href={`/ordenes/${m.orden_id}`} className={enlace}>
        {m.ordenes_servicio.folio}
      </Link>,
    ]);
  if (m.oportunidad_id && m.oportunidades)
    datos.push([
      "Oportunidad",
      <Link
        key="p"
        href={`/oportunidades/${m.oportunidad_id}`}
        className={enlace}
      >
        {m.oportunidades.nombre}
      </Link>,
    ]);

  return (
    <div className="mx-auto max-w-3xl">
      <title>{`Muestra ${m.id_muestra} · Sistema MOT`}</title>
      <PageHeader
        title={`Muestra ${m.id_muestra}`}
        description={`${m.cuentas?.nombre ?? ""}${m.equipos_cliente ? ` · ${nombreEquipo(m.equipos_cliente)}` : ""}`}
      >
        {edita ? (
          <Link
            href={`/laboratorio/muestras/${m.id}/editar`}
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            Editar
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <EstadoMuestraBadge estado={m.estado} />
        {edita && accionesMuestra(m.estado).recibir ? (
          <form action={recibirMuestra.bind(null, m.id)}>
            <Button type="submit" size="sm" className="h-8">
              Recibida hoy en laboratorio
            </Button>
          </form>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la muestra</CardTitle>
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
            {m.notas ? (
              <p className="mt-4 text-sm whitespace-pre-line text-muted-foreground">
                {m.notas}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          Los resultados del análisis se capturarán aquí en el siguiente paso.
        </Card>
      </div>
    </div>
  );
}
