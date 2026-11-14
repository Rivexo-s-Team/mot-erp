import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CerrarOrden } from "@/components/cerrar-orden";
import { PageHeader } from "@/components/layout/page-header";
import { OrdenCaptura } from "@/components/orden-captura";
import { OrdenEvidencias } from "@/components/orden-evidencias";
import { EstadoOrdenBadge } from "@/components/orden-estado-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia, formatFecha } from "@/lib/format";
import { accionesOrden, etiqueta, TIPOS_ORDEN } from "@/lib/ordenes/campos";
import { faltantesParaCerrar } from "@/lib/ordenes/captura";
import {
  catalogosCaptura,
  directorioTecnicos,
  evidenciasDeOrden,
  obtenerCaptura,
  obtenerOrden,
} from "@/lib/ordenes/data";
import { cambiarEstadoOrden } from "../actions";

const enlace = "text-primary underline-offset-4 hover:underline";
const botonChico = buttonVariants({ variant: "outline", className: "h-9" });

export default async function OrdenPage({
  params,
}: PageProps<"/ordenes/[id]">) {
  const sesion = await requirePermiso("ordenes.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [o, { nombres }] = await Promise.all([
    obtenerOrden(id),
    directorioTecnicos(),
  ]);
  if (!o) notFound();

  // El técnico solo cambia las órdenes donde participa; Dirección, todas.
  const puedeEditar =
    tienePermiso(sesion, "ordenes.editar") &&
    (tienePermiso(sesion, "ordenes.administrar") ||
      o.tecnico_id === sesion.id ||
      o.acompanante_id === sesion.id);
  const acciones = accionesOrden(o.estado);
  const [{ captura, hayCaptura }, evidencias] = await Promise.all([
    obtenerCaptura(o.id),
    evidenciasDeOrden(o.id),
  ]);
  const catalogos = hayCaptura ? await catalogosCaptura(captura) : null;

  const datos: [string, React.ReactNode][] = [
    ["Tipo", etiqueta(TIPOS_ORDEN, o.tipo)],
  ];
  if (o.cuenta_id && o.cuentas) {
    datos.push(
      [
        "Cliente",
        tienePermiso(sesion, "clientes.ver") ? (
          <Link key="c" href={`/clientes/${o.cuenta_id}`} className={enlace}>
            {o.cuentas.nombre}
          </Link>
        ) : (
          o.cuentas.nombre
        ),
      ],
      ["Planta", o.plantas?.nombre ?? "—"],
      [
        "Equipo del cliente",
        o.equipos_cliente ? nombreEquipo(o.equipos_cliente) : "Sin definir",
      ],
    );
    if (o.contrato_id && tienePermiso(sesion, "contratos.ver")) {
      datos.push([
        "Contrato",
        <Link key="k" href={`/contratos/${o.contrato_id}`} className={enlace}>
          Ver contrato
        </Link>,
      ]);
    }
  }
  datos.push(
    [
      "Robox",
      o.robox_id && o.robox ? (
        <Link key="r" href={`/flota/${o.robox_id}`} className={enlace}>
          {o.robox.numero_serie}
        </Link>
      ) : (
        "Sin definir"
      ),
    ],
    ["Técnico responsable", nombres.get(o.tecnico_id) ?? "—"],
    [
      "Acompañante",
      o.acompanante_id ? (nombres.get(o.acompanante_id) ?? "—") : "—",
    ],
    ["Fecha programada", formatDia(o.fecha_programada)],
    ["Fecha del servicio", o.fecha_real ? formatDia(o.fecha_real) : "—"],
    ["Último cambio", formatFecha(o.updated_at)],
  );

  return (
    <>
      <title>{`Orden ${o.folio} · Sistema MOT`}</title>
      <PageHeader
        title={`Orden ${o.folio}`}
        description={
          o.cuentas
            ? `${o.cuentas.nombre}${o.plantas ? ` · ${o.plantas.nombre}` : ""}`
            : "Trabajo de taller"
        }
      >
        <Link href="/ordenes" className={botonChico}>
          Órdenes
        </Link>
        {o.estado !== "programada" ? (
          <a
            href={`/ordenes/${o.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className={botonChico}
          >
            PDF
          </a>
        ) : null}
        {puedeEditar && acciones.editar ? (
          <Link href={`/ordenes/${o.id}/editar`} className={botonChico}>
            Editar
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <EstadoOrdenBadge estado={o.estado} />
        {puedeEditar && acciones.iniciar ? (
          <form
            action={cambiarEstadoOrden.bind(null, o.id, "iniciar", "ordenes")}
          >
            <Button type="submit" size="sm" className="h-8">
              Iniciar orden
            </Button>
          </form>
        ) : null}
        {puedeEditar && o.estado === "en_curso" ? (
          <Link
            href={`/campo/ordenes/${o.id}/captura`}
            className={buttonVariants({ size: "sm", className: "h-8" })}
          >
            Capturar visita
          </Link>
        ) : null}
        {puedeEditar && acciones.cerrar ? (
          <CerrarOrden
            ordenId={o.id}
            faltantes={faltantesParaCerrar(captura, o.tipo)}
            volver="ordenes"
          />
        ) : null}
        {puedeEditar && acciones.cancelar ? (
          <form
            action={cambiarEstadoOrden.bind(null, o.id, "cancelar", "ordenes")}
          >
            <Button type="submit" variant="outline" size="sm" className="h-8">
              Cancelar orden
            </Button>
          </form>
        ) : null}
        {puedeEditar && acciones.reactivar ? (
          <form
            action={cambiarEstadoOrden.bind(null, o.id, "reactivar", "ordenes")}
          >
            <Button type="submit" variant="outline" size="sm" className="h-8">
              Reactivar
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Datos de la orden</CardTitle>
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
            {o.notas ? (
              <p className="mt-4 text-sm whitespace-pre-line text-muted-foreground">
                {o.notas}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <div className="space-y-6">
          {catalogos ? (
            <OrdenCaptura
              captura={captura}
              actividades={catalogos.actividades}
              fallas={catalogos.fallas}
              partes={catalogos.partes}
              esVisita={o.tipo === "visita"}
            />
          ) : (
            <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aún no se captura nada de la visita. El técnico lo llena desde
              Campo, en su celular, con la orden en curso.
            </Card>
          )}
          <OrdenEvidencias
            ordenId={o.id}
            evidencias={evidencias}
            editable={puedeEditar && o.estado === "en_curso"}
          />
        </div>
      </div>
    </>
  );
}
