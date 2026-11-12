import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EstadoRoboxBadge } from "@/components/flota-estado-badge";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { obtenerRobox } from "@/lib/flota/data";
import { formatDia, formatFecha } from "@/lib/format";

export default async function RoboxPage({ params }: PageProps<"/flota/[id]">) {
  const sesion = await requirePermiso("flota.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const robox = await obtenerRobox(id);
  if (!robox) notFound();

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
        <Link
          href="/flota"
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Flota
        </Link>
        {tienePermiso(sesion, "flota.editar") ? (
          <Link
            href={`/flota/${robox.id}/editar`}
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            Editar
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-6">
        <EstadoRoboxBadge estado={robox.estado} />
      </div>

      <Card className="max-w-2xl">
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
    </>
  );
}
