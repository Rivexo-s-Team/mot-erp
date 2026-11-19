import { TablaLista } from "@/components/tabla-lista";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { listarCuentas } from "@/lib/clientes/data";
import {
  nombreTipoCuenta,
  TIPOS_CUENTA,
  VARIANTE_TIPO_CUENTA,
} from "@/lib/clientes/tipo";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage({
  searchParams,
}: PageProps<"/clientes">) {
  const sesion = await requirePermiso("clientes.ver");
  const { q, tipo: tipoParam } = await searchParams;
  const busqueda = typeof q === "string" ? q : "";
  const tipo = TIPOS_CUENTA.some((t) => t.value === tipoParam)
    ? String(tipoParam)
    : "";
  const todas = await listarCuentas(busqueda);
  const cuentas = tipo ? todas.filter((c) => c.tipo === tipo) : todas;
  const filtros = [
    { value: "", label: "Todos", cantidad: todas.length },
    ...TIPOS_CUENTA.map((t) => ({
      ...t,
      cantidad: todas.filter((c) => c.tipo === t.value).length,
    })),
  ];
  const enlace = (t: string) => {
    const p = new URLSearchParams();
    if (busqueda) p.set("q", busqueda);
    if (t) p.set("tipo", t);
    const texto = p.toString();
    return texto ? `/clientes?${texto}` : "/clientes";
  };

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

      <nav aria-label="Filtrar por tipo" className="mb-4 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <Link
            key={f.value}
            href={enlace(f.value)}
            aria-current={f.value === tipo ? "true" : undefined}
            className={buttonVariants({
              variant: f.value === tipo ? "default" : "outline",
              size: "sm",
              className: "h-8",
            })}
          >
            {f.label}
            <span className="tabular-nums opacity-70">{f.cantidad}</span>
          </Link>
        ))}
      </nav>

      <form action="/clientes" className="mb-4 flex gap-2">
        {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}
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
          {tipo && todas.length > 0
            ? "No hay cuentas de ese tipo."
            : busqueda
              ? `No hay clientes que coincidan con "${busqueda}".`
              : "Todavía no hay clientes. Agrega la primera cuenta."}
        </Card>
      ) : (
        <>
          <TablaLista
            filas={cuentas}
            clave={(c) => c.id}
            href={(c) => `/clientes/${c.id}`}
            columnas={[
              { titulo: "Cliente", celda: (c) => c.nombre },
              {
                titulo: "Tipo",
                celda: (c) => (
                  <Badge variant={VARIANTE_TIPO_CUENTA[c.tipo]}>
                    {nombreTipoCuenta(c.tipo)}
                  </Badge>
                ),
              },
              { titulo: "Industria", celda: (c) => c.tipo_industria ?? "—" },
              {
                titulo: "Plantas",
                celda: (c) =>
                  c.plantas.length === 0
                    ? "Sin plantas"
                    : c.plantas.map((p) => p.nombre).join(" · "),
              },
            ]}
          />
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:hidden">
            {cuentas.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="block h-full">
                  <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">{c.nombre}</p>
                      <Badge variant={VARIANTE_TIPO_CUENTA[c.tipo]}>
                        {nombreTipoCuenta(c.tipo)}
                      </Badge>
                    </div>
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
        </>
      )}
    </>
  );
}
