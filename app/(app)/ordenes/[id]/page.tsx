import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AccesoPlanta } from "@/components/acceso-planta";
import { CerrarOrden } from "@/components/cerrar-orden";
import { PageHeader } from "@/components/layout/page-header";
import { MuestrasSeccion } from "@/components/muestras-seccion";
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
import { requisitosDeAcceso, revisionDeAcceso } from "@/lib/acceso/data";
import { porCompletar } from "@/lib/cargos/campos";
import { listarCargos, ordenPermiteCargoAlCliente } from "@/lib/cargos/data";
import { formatImporte } from "@/lib/format";
import { listarMuestras } from "@/lib/laboratorio/data";
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
  // Cargos de la orden: son importes, solo para quien puede verlos.
  const veCargos =
    tienePermiso(sesion, "cargos.ver") && tienePermiso(sesion, "precios.ver");
  const editaCargos = veCargos && tienePermiso(sesion, "cargos.editar");
  const [cargos, permiteCargo] = veCargos
    ? await Promise.all([
        listarCargos({ ordenId: o.id }),
        o.cuenta_id ? ordenPermiteCargoAlCliente(o.id) : false,
      ])
    : [[], false];
  const yaCobroMalUso = cargos.some(
    (c) => c.tipo === "partes_mal_uso" && c.estado !== "cancelado",
  );
  // Muestras de aceite tomadas en esta visita.
  const muestras =
    o.cuenta_id && tienePermiso(sesion, "laboratorio.ver")
      ? await listarMuestras({ ordenId: o.id })
      : null;
  const registraMuestras =
    tienePermiso(sesion, "laboratorio.editar") && o.estado !== "cancelada";
  // Antes de la visita: requisitos de la planta y documentos de quienes van.
  const verAcceso =
    o.tipo === "visita" &&
    o.planta_id !== null &&
    (o.estado === "programada" || o.estado === "en_curso") &&
    tienePermiso(sesion, "documentos_acceso.ver");
  const acceso =
    verAcceso && o.planta_id
      ? await Promise.all([
          requisitosDeAcceso(o.planta_id),
          revisionDeAcceso(
            o.acompanante_id
              ? [o.tecnico_id, o.acompanante_id]
              : [o.tecnico_id],
          ),
        ])
      : null;

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
        migas={[{ label: "Órdenes de servicio", href: "/ordenes" }]}
        title={`Orden ${o.folio}`}
        description={
          o.cuentas
            ? `${o.cuentas.nombre}${o.plantas ? ` · ${o.plantas.nombre}` : ""}`
            : "Trabajo de taller"
        }
      >
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
          {acceso ? (
            <AccesoPlanta requisitos={acceso[0]} documentos={acceso[1]} />
          ) : null}
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
          {veCargos && (cargos.length > 0 || permiteCargo) ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">
                Cargos al cliente
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {cargos.length}
                </span>
              </h2>
              {permiteCargo && !yaCobroMalUso ? (
                <Card className="mb-2 gap-2 px-4 py-3 text-sm">
                  <p>
                    Esta orden tiene marcada la falla de componente dañado por
                    el cliente: se le puede cobrar.
                  </p>
                  {editaCargos ? (
                    <Link
                      href={`/cargos/nuevo?orden=${o.id}`}
                      className={buttonVariants({
                        size: "sm",
                        className: "h-8 w-fit",
                      })}
                    >
                      Generar cargo al cliente
                    </Link>
                  ) : null}
                </Card>
              ) : null}
              <ul className="space-y-2">
                {cargos.map((c) => (
                  <li key={c.id}>
                    <Card className="gap-1 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium break-words">
                          {c.concepto}
                        </p>
                        <p className="font-medium tabular-nums">
                          {c.importe !== null
                            ? formatImporte(c.importe, c.moneda)
                            : "Por completar"}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {c.estado === "pendiente"
                          ? porCompletar(c)
                            ? "Le falta un dato para poder facturarse"
                            : "Pendiente de facturar"
                          : c.estado === "cancelado"
                            ? "Cancelado"
                            : "Facturado"}
                        {editaCargos && c.estado !== "facturado" ? (
                          <>
                            {" · "}
                            <Link href={`/cargos/${c.id}`} className={enlace}>
                              Editar
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {muestras && (muestras.length > 0 || registraMuestras) ? (
            <MuestrasSeccion
              muestras={muestras}
              nuevaHref={
                registraMuestras
                  ? `/laboratorio/muestras/nueva?orden=${o.id}`
                  : null
              }
              vacio="Aún no se registran muestras de esta visita."
            />
          ) : null}
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
