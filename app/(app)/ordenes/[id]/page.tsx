import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { EstadoOrdenBadge } from "@/components/orden-estado-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia, formatFecha } from "@/lib/format";
import { accionesOrden, etiqueta, TIPOS_ORDEN } from "@/lib/ordenes/campos";
import { directorioTecnicos, obtenerOrden } from "@/lib/ordenes/data";
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

      <Card className="max-w-2xl">
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
    </>
  );
}
