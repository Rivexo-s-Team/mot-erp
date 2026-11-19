import { Busqueda } from "@/components/busqueda";
import { EstadoMuestraBadge } from "@/components/muestra-estado-badge";
import { TablaLista } from "@/components/tabla-lista";
import { coincide } from "@/lib/buscar";
import { formatDia } from "@/lib/format";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { MuestrasLista } from "@/components/muestras-lista";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { listarMuestras } from "@/lib/laboratorio/data";
import { nombreEquipo } from "@/lib/flota/campos";
import {
  ESTADOS_MUESTRA,
  etiqueta,
  TIPOS_MUESTRA,
} from "@/lib/laboratorio/muestras";

export const metadata: Metadata = { title: "Muestras" };

export default async function MuestrasPage({
  searchParams,
}: PageProps<"/laboratorio/muestras">) {
  const sesion = await requirePermiso("laboratorio.ver");
  const { estado: estadoParam, q } = await searchParams;
  const busqueda = typeof q === "string" ? q : "";
  // Sin filtro se ven las que el laboratorio aún tiene en proceso.
  const estado =
    estadoParam === "todas" ||
    ESTADOS_MUESTRA.some((e) => e.value === estadoParam)
      ? String(estadoParam)
      : "en_proceso";
  const edita = tienePermiso(sesion, "laboratorio.editar");

  const todas = await listarMuestras(
    estado === "en_proceso"
      ? { enProceso: true }
      : estado === "todas"
        ? {}
        : { estado },
  );
  const muestras = todas.filter((m) =>
    coincide(busqueda, [
      m.id_muestra,
      m.cuentas?.nombre,
      m.plantas?.nombre,
      m.equipos_cliente ? nombreEquipo(m.equipos_cliente) : null,
    ]),
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

      <Busqueda
        accion="/laboratorio/muestras"
        valor={busqueda}
        placeholder="Buscar por ID, cliente o equipo…"
        conservar={{ estado }}
      />

      {muestras.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          {busqueda
            ? `No hay muestras que coincidan con "${busqueda}".`
            : "No hay muestras en este estado."}
        </Card>
      ) : (
        <>
          <TablaLista
            filas={muestras}
            clave={(m) => m.id}
            href={(m) => `/laboratorio/muestras/${m.id}`}
            columnas={[
              { titulo: "Muestra", celda: (m) => m.id_muestra },
              { titulo: "Cliente", celda: (m) => m.cuentas?.nombre ?? "—" },
              {
                titulo: "Equipo",
                celda: (m) =>
                  `${m.equipos_cliente ? nombreEquipo(m.equipos_cliente) : "—"}${m.plantas ? ` · ${m.plantas.nombre}` : ""}`,
              },
              { titulo: "Tipo", celda: (m) => etiqueta(TIPOS_MUESTRA, m.tipo) },
              { titulo: "Muestreo", celda: (m) => formatDia(m.fecha_muestreo) },
              {
                titulo: "Estado",
                celda: (m) => <EstadoMuestraBadge estado={m.estado} />,
              },
            ]}
          />
          <div className="lg:hidden">
            <MuestrasLista muestras={muestras} />
          </div>
        </>
      )}
    </>
  );
}
