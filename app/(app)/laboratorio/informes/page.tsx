import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia } from "@/lib/format";
import { listarInformes } from "@/lib/laboratorio/data";
import { CONDICIONES } from "@/lib/laboratorio/evaluacion";
import {
  ESTADOS_INFORME,
  type ContenidoInforme,
} from "@/lib/laboratorio/informe";

export const metadata: Metadata = { title: "Informes de laboratorio" };

export default async function InformesPage({
  searchParams,
}: PageProps<"/laboratorio/informes">) {
  const sesion = await requirePermiso("laboratorio.ver");
  const { estado: estadoParam } = await searchParams;
  const estado = ESTADOS_INFORME.some((e) => e.value === estadoParam)
    ? String(estadoParam)
    : "";
  const edita = tienePermiso(sesion, "laboratorio.editar");
  const informes = await listarInformes({ estado });
  const filtros = [
    { value: "", label: "Todos" },
    { value: "borrador", label: "En borrador" },
    { value: "validado", label: "Validados" },
  ];

  return (
    <>
      <PageHeader
        title="Informes de laboratorio"
        description="Tendencia del aceite de cada equipo, con sus muestras, condición y observaciones."
      >
        {edita ? (
          <Link
            href="/laboratorio/informes/nuevo"
            className={buttonVariants({ className: "h-9" })}
          >
            Nuevo informe
          </Link>
        ) : null}
      </PageHeader>

      <nav
        aria-label="Filtrar por estado"
        className="mb-4 flex flex-wrap gap-2"
      >
        {filtros.map((f) => {
          const activo = estado === f.value;
          return (
            <Link
              key={f.value}
              href={
                f.value
                  ? `/laboratorio/informes?estado=${f.value}`
                  : "/laboratorio/informes"
              }
              aria-current={activo ? "true" : undefined}
              className={buttonVariants({
                variant: activo ? "default" : "outline",
                size: "sm",
                className: "h-8",
              })}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {informes.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          No hay informes{estado ? " en este estado" : ""}.
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {informes.map((i) => {
            // Solo un informe validado tiene su condición fija.
            const condicion =
              i.estado === "validado"
                ? (i.contenido as unknown as ContenidoInforme | null)
                    ?.condicionGeneral
                : null;
            return (
              <li key={i.id}>
                <Link
                  href={`/laboratorio/informes/${i.id}`}
                  className="block h-full"
                >
                  <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium break-words">{i.folio}</p>
                      <Badge
                        variant={
                          i.estado === "validado" ? "outline" : "secondary"
                        }
                      >
                        {i.estado === "validado" ? "Validado" : "Borrador"}
                      </Badge>
                    </div>
                    <p className="text-sm break-words">
                      {i.cuentas?.nombre ?? "—"} ·{" "}
                      {i.equipos_cliente
                        ? nombreEquipo(i.equipos_cliente)
                        : "—"}
                      {i.plantas ? ` · ${i.plantas.nombre}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Emitido el {formatDia(i.fecha_emision)} ·{" "}
                      {i.informe_muestras.length}{" "}
                      {i.informe_muestras.length === 1 ? "muestra" : "muestras"}
                      {condicion ? ` · ${CONDICIONES[condicion]}` : ""}
                    </p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
