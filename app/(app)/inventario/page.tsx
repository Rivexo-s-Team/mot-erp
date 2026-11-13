import type { Metadata } from "next";
import Link from "next/link";
import { ExistenciaBadge } from "@/components/existencia-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { formatDia } from "@/lib/format";
import { listarExistencias } from "@/lib/inventario/data";

export const metadata: Metadata = { title: "Inventario" };

const TIPOS = [
  { value: "", label: "Todo" },
  { value: "parte", label: "Partes" },
  { value: "accesorio", label: "Accesorios" },
];

export default async function InventarioPage({
  searchParams,
}: PageProps<"/inventario">) {
  const sesion = await requirePermiso("inventario.ver");
  const { tipo: tipoParam, q } = await searchParams;
  const tipo = TIPOS.some((t) => t.value === tipoParam)
    ? String(tipoParam)
    : "";
  const busqueda = typeof q === "string" ? q : "";
  const partes = await listarExistencias({ tipo, busqueda });

  const href = (t: string) => {
    const params = new URLSearchParams();
    if (t) params.set("tipo", t);
    if (busqueda) params.set("q", busqueda);
    const texto = params.toString();
    return texto ? `/inventario?${texto}` : "/inventario";
  };

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Existencia de partes y accesorios. Lo usado en una orden sale solo al cerrarla."
      >
        {tienePermiso(sesion, "inventario.editar") ? (
          <Link
            href="/inventario/movimiento"
            className={buttonVariants({ className: "h-9" })}
          >
            Registrar movimiento
          </Link>
        ) : null}
      </PageHeader>

      <nav aria-label="Filtrar por tipo" className="mb-3 flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <Link
            key={t.value}
            href={href(t.value)}
            aria-current={t.value === tipo ? "true" : undefined}
            className={buttonVariants({
              variant: t.value === tipo ? "default" : "outline",
              size: "sm",
              className: "h-8",
            })}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <form action="/inventario" className="mb-4 flex gap-2">
        {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}
        <Input
          name="q"
          type="search"
          defaultValue={busqueda}
          placeholder="Buscar parte o accesorio…"
          aria-label="Buscar parte o accesorio"
          className="h-10 max-w-sm bg-background"
        />
        <Button type="submit" variant="outline" className="h-10">
          Buscar
        </Button>
      </form>

      {partes.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          No hay partes que coincidan. El catálogo se edita en Catálogos, Partes
          y accesorios.
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {partes.map((p) => (
            <li key={p.id}>
              <Link href={`/inventario/${p.id}`} className="block h-full">
                <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{p.nombre}</p>
                    <ExistenciaBadge existencia={p.existencia} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {p.tipo === "accesorio" ? "Accesorio" : "Parte"}
                    {p.ultimoMovimiento
                      ? ` · último movimiento ${formatDia(p.ultimoMovimiento)}`
                      : " · sin movimientos"}
                    {p.activo ? "" : " · inactiva"}
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
