import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ExistenciaBadge } from "@/components/existencia-badge";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { formatDia } from "@/lib/format";
import { etiquetaMovimiento, textoCantidad } from "@/lib/inventario/campos";
import { obtenerParte } from "@/lib/inventario/data";

const botonChico = buttonVariants({ variant: "outline", className: "h-9" });

export default async function PartePage({
  params,
}: PageProps<"/inventario/[parte]">) {
  const sesion = await requirePermiso("inventario.ver");
  const { parte: id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const p = await obtenerParte(id);
  if (!p) notFound();
  const veOrdenes = tienePermiso(sesion, "ordenes.ver");

  return (
    <>
      <title>{`${p.nombre} · Inventario · Sistema MOT`}</title>
      <PageHeader
        title={p.nombre}
        description={p.tipo === "accesorio" ? "Accesorio" : "Parte"}
      >
        <Link href="/inventario" className={botonChico}>
          Inventario
        </Link>
        {tienePermiso(sesion, "inventario.editar") && p.activo ? (
          <Link
            href={`/inventario/movimiento?parte=${p.id}`}
            className={buttonVariants({ className: "h-9" })}
          >
            Registrar movimiento
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Existencia</span>
        <ExistenciaBadge existencia={p.existencia} />
        {p.existencia < 0 ? (
          <span className="text-muted-foreground">
            Se usaron más piezas de las registradas. Registra la entrada que
            falta o haz un ajuste por conteo.
          </span>
        ) : null}
      </div>
      {p.notas ? (
        <p className="mb-6 text-sm text-muted-foreground">{p.notas}</p>
      ) : null}

      <h2 className="mb-3 text-lg font-semibold tracking-tight">
        Movimientos
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {p.movimientos.length}
        </span>
      </h2>
      {p.movimientos.length === 0 ? (
        <Card className="max-w-2xl px-4 py-6 text-center text-sm text-muted-foreground">
          Sin movimientos. Registra una entrada con lo que hay hoy en el
          almacén.
        </Card>
      ) : (
        <ul className="max-w-2xl space-y-2">
          {p.movimientos.map((m) => (
            <li key={m.id}>
              <Card className="gap-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {etiquetaMovimiento(m.tipo)}
                    <span className="ml-2 tabular-nums">
                      {textoCantidad(m.cantidad)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDia(m.fecha)}
                  </p>
                </div>
                {m.orden_id && m.ordenes_servicio ? (
                  <p className="text-sm text-muted-foreground">
                    Orden de servicio{" "}
                    {veOrdenes ? (
                      <Link
                        href={`/ordenes/${m.orden_id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {m.ordenes_servicio.folio}
                      </Link>
                    ) : (
                      m.ordenes_servicio.folio
                    )}
                  </p>
                ) : null}
                {m.referencia ? (
                  <p className="text-sm text-muted-foreground">
                    {m.referencia}
                  </p>
                ) : null}
                {m.notas ? (
                  <p className="text-sm whitespace-pre-line">{m.notas}</p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
