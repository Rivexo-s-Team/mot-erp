import type { Metadata } from "next";
import Link from "next/link";
import { EstadoRoboxBadge } from "@/components/flota-estado-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { ESTADOS_ROBOX } from "@/lib/flota/campos";
import { contarPorEstado, listarRobox } from "@/lib/flota/data";

export const metadata: Metadata = { title: "Flota" };

export default async function FlotaPage({ searchParams }: PageProps<"/flota">) {
  const sesion = await requirePermiso("flota.ver");
  const { estado: estadoParam, q } = await searchParams;
  const estado = ESTADOS_ROBOX.some((e) => e.value === estadoParam)
    ? String(estadoParam)
    : "";
  const busqueda = typeof q === "string" ? q : "";

  const [robox, { conteo, total }] = await Promise.all([
    listarRobox({ estado, busqueda }),
    contarPorEstado(),
  ]);
  const href = (e: string) => {
    const params = new URLSearchParams();
    if (e) params.set("estado", e);
    if (busqueda) params.set("q", busqueda);
    const texto = params.toString();
    return texto ? `/flota?${texto}` : "/flota";
  };
  const filtros = [
    { value: "", label: "Todos", cantidad: total },
    ...ESTADOS_ROBOX.map((e) => ({ ...e, cantidad: conteo.get(e.value) ?? 0 })),
  ];

  return (
    <>
      <PageHeader
        title="Flota"
        description="Los Robox de MOT: número de serie, estado y datos del equipo."
      >
        {tienePermiso(sesion, "flota.editar") ? (
          <Link
            href="/flota/nuevo"
            className={buttonVariants({ className: "h-9" })}
          >
            Nuevo Robox
          </Link>
        ) : null}
      </PageHeader>

      <nav
        aria-label="Filtrar por estado"
        className="mb-3 flex flex-wrap gap-2"
      >
        {filtros.map((f) => (
          <Link
            key={f.value}
            href={href(f.value)}
            aria-current={f.value === estado ? "true" : undefined}
            className={buttonVariants({
              variant: f.value === estado ? "default" : "outline",
              size: "sm",
              className: "h-8",
            })}
          >
            {f.label}
            <span className="tabular-nums opacity-70">{f.cantidad}</span>
          </Link>
        ))}
      </nav>

      <form action="/flota" className="mb-4 flex gap-2">
        {estado ? <input type="hidden" name="estado" value={estado} /> : null}
        <Input
          name="q"
          type="search"
          defaultValue={busqueda}
          placeholder="Buscar por número de serie…"
          aria-label="Buscar Robox por número de serie"
          className="h-10 max-w-sm bg-background"
        />
        <Button type="submit" variant="outline" className="h-10">
          Buscar
        </Button>
      </form>

      {robox.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          {total === 0
            ? "Todavía no hay Robox registrados."
            : "No hay Robox que coincidan con ese filtro."}
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {robox.map((r) => (
            <li key={r.id}>
              <Link href={`/flota/${r.id}`} className="block h-full">
                <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium tabular-nums">{r.numero_serie}</p>
                    <EstadoRoboxBadge estado={r.estado} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[
                      r.modelo ? `Modelo ${r.modelo}` : null,
                      r.version_programa
                        ? `Programa ${r.version_programa}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin modelo ni versión registrados"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
