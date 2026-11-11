import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { listarCuentas } from "@/lib/clientes/data";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage({
  searchParams,
}: PageProps<"/clientes">) {
  const sesion = await requirePermiso("clientes.ver");
  const { q } = await searchParams;
  const busqueda = typeof q === "string" ? q : "";
  const cuentas = await listarCuentas(busqueda);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cuentas, con sus plantas, razones sociales y contactos."
      >
        {tienePermiso(sesion, "clientes.editar") ? (
          <Link
            href="/clientes/nueva"
            className={buttonVariants({ className: "h-9" })}
          >
            Nueva cuenta
          </Link>
        ) : null}
      </PageHeader>

      <form action="/clientes" className="mb-4 flex gap-2">
        <Input
          name="q"
          type="search"
          defaultValue={busqueda}
          placeholder="Buscar por nombre…"
          aria-label="Buscar cliente por nombre"
          className="h-10 max-w-sm bg-background"
        />
        <Button type="submit" variant="outline" className="h-10">
          Buscar
        </Button>
      </form>

      {cuentas.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          {busqueda
            ? `No hay clientes que coincidan con "${busqueda}".`
            : "Todavía no hay clientes. Agrega la primera cuenta."}
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cuentas.map((c) => (
            <li key={c.id}>
              <Link href={`/clientes/${c.id}`} className="block h-full">
                <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <p className="font-medium">{c.nombre}</p>
                  {c.tipo_industria ? (
                    <p className="text-sm text-muted-foreground">
                      {c.tipo_industria}
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    {c.plantas.length === 0
                      ? "Sin plantas"
                      : c.plantas.map((p) => p.nombre).join(" · ")}
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
