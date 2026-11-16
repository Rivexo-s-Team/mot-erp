import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { MuestrasLista } from "@/components/muestras-lista";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { listarMuestras } from "@/lib/laboratorio/data";
import { ESTADOS_MUESTRA } from "@/lib/laboratorio/muestras";

export const metadata: Metadata = { title: "Muestras" };

export default async function MuestrasPage({
  searchParams,
}: PageProps<"/laboratorio/muestras">) {
  const sesion = await requirePermiso("laboratorio.ver");
  const { estado: estadoParam } = await searchParams;
  // Sin filtro se ven las que el laboratorio aún tiene en proceso.
  const estado =
    estadoParam === "todas" ||
    ESTADOS_MUESTRA.some((e) => e.value === estadoParam)
      ? String(estadoParam)
      : "en_proceso";
  const edita = tienePermiso(sesion, "laboratorio.editar");

  const muestras = await listarMuestras(
    estado === "en_proceso"
      ? { enProceso: true }
      : estado === "todas"
        ? {}
        : { estado },
  );
  const filtros = [
    { value: "en_proceso", label: "En proceso" },
    ...ESTADOS_MUESTRA,
    { value: "todas", label: "Todas" },
  ];

  return (
    <>
      <PageHeader
        title="Muestras"
        description="Muestras de aceite que se toman en las plantas y llegan al laboratorio."
      >
        {edita ? (
          <Link
            href="/laboratorio/muestras/nueva"
            className={buttonVariants({ className: "h-9" })}
          >
            Nueva muestra
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
              href={`/laboratorio/muestras?estado=${f.value}`}
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

      {muestras.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          No hay muestras en este estado.
        </Card>
      ) : (
        <MuestrasLista muestras={muestras} />
      )}
    </>
  );
}
