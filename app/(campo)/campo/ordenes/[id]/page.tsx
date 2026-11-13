import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CerrarOrden } from "@/components/cerrar-orden";
import { OrdenCaptura } from "@/components/orden-captura";
import { OrdenEvidencias } from "@/components/orden-evidencias";
import { EstadoOrdenBadge } from "@/components/orden-estado-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia } from "@/lib/format";
import { accionesOrden } from "@/lib/ordenes/campos";
import { faltantesParaCerrar } from "@/lib/ordenes/captura";
import {
  catalogosCaptura,
  directorioTecnicos,
  evidenciasDeOrden,
  lugarOrden,
  obtenerCaptura,
  obtenerOrden,
} from "@/lib/ordenes/data";
import { cambiarEstadoOrden } from "@/app/(app)/ordenes/actions";

export default async function OrdenCampoPage({
  params,
}: PageProps<"/campo/ordenes/[id]">) {
  const sesion = await requirePermiso("ordenes.editar");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [o, { nombres }] = await Promise.all([
    obtenerOrden(id),
    directorioTecnicos(),
  ]);
  if (!o) notFound();

  const puedeEditar =
    tienePermiso(sesion, "ordenes.administrar") ||
    o.tecnico_id === sesion.id ||
    o.acompanante_id === sesion.id;
  const acciones = accionesOrden(o.estado);
  const [{ captura, hayCaptura }, evidencias] = await Promise.all([
    obtenerCaptura(o.id),
    evidenciasDeOrden(o.id),
  ]);
  const catalogos = hayCaptura ? await catalogosCaptura(captura) : null;
  const datos: [string, string][] = [
    [
      "Equipo",
      o.equipos_cliente ? nombreEquipo(o.equipos_cliente) : "Sin definir",
    ],
    ["Robox", o.robox?.numero_serie ?? "Sin definir"],
    ["Técnico", nombres.get(o.tecnico_id) ?? "—"],
  ];
  if (o.acompanante_id)
    datos.push(["Acompañante", nombres.get(o.acompanante_id) ?? "—"]);
  datos.push(["Programada", formatDia(o.fecha_programada)]);
  if (o.fecha_real) datos.push(["Iniciada", formatDia(o.fecha_real)]);

  return (
    <>
      <title>{`Orden ${o.folio} · Sistema MOT`}</title>
      <Link
        href="/campo"
        className="mb-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        ← Mis órdenes
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lugarOrden(o)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            Folio {o.folio}
          </p>
        </div>
        <EstadoOrdenBadge estado={o.estado} />
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {datos.map(([nombre, valor]) => (
              <div key={nombre} className="contents">
                <dt className="text-muted-foreground">{nombre}</dt>
                <dd className="break-words">{valor}</dd>
              </div>
            ))}
          </dl>
          {o.notas ? (
            <p className="mt-4 text-sm whitespace-pre-line">{o.notas}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-col gap-3">
        {puedeEditar && acciones.iniciar ? (
          <form
            action={cambiarEstadoOrden.bind(null, o.id, "iniciar", "campo")}
          >
            <Button type="submit" className="h-12 w-full text-base">
              Iniciar orden
            </Button>
          </form>
        ) : null}
        {puedeEditar && o.estado === "en_curso" ? (
          <Link
            href={`/campo/ordenes/${o.id}/captura`}
            className={buttonVariants({ className: "h-12 w-full text-base" })}
          >
            {hayCaptura ? "Continuar captura" : "Capturar visita"}
          </Link>
        ) : null}
        {puedeEditar && acciones.cerrar ? (
          <CerrarOrden
            ordenId={o.id}
            faltantes={faltantesParaCerrar(captura, o.tipo)}
            volver="campo"
            grande
          />
        ) : null}
        {puedeEditar && acciones.editar ? (
          <Link
            href={`/ordenes/${o.id}/editar`}
            className={buttonVariants({
              variant: "outline",
              className: "h-11 w-full",
            })}
          >
            Cambiar datos de la orden
          </Link>
        ) : null}
      </div>

      {catalogos ? (
        <div className="mt-6">
          <OrdenCaptura
            captura={captura}
            actividades={catalogos.actividades}
            fallas={catalogos.fallas}
            esVisita={o.tipo === "visita"}
          />
        </div>
      ) : null}

      {o.estado === "en_curso" || evidencias.length > 0 ? (
        <div className="mt-6">
          <OrdenEvidencias
            ordenId={o.id}
            evidencias={evidencias}
            editable={puedeEditar && o.estado === "en_curso"}
          />
        </div>
      ) : null}
    </>
  );
}
