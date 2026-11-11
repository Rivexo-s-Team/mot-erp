import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { direccionPlanta, etiquetaArea } from "@/lib/clientes/campos";
import { contarEquiposPorPlanta, obtenerCuenta } from "@/lib/clientes/data";
import { ETAPAS, etiqueta } from "@/lib/pipeline/campos";
import { oportunidadesDeCuenta } from "@/lib/pipeline/data";

export default async function CuentaPage({
  params,
}: PageProps<"/clientes/[id]">) {
  const sesion = await requirePermiso("clientes.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const cuenta = await obtenerCuenta(id);
  if (!cuenta) notFound();

  const editaClientes = tienePermiso(sesion, "clientes.editar");
  const editaRazones = tienePermiso(sesion, "razones_sociales.editar");
  const base = `/clientes/${cuenta.id}`;
  const razonPorId = new Map(cuenta.razonesSociales.map((r) => [r.id, r]));
  const plantaPorId = new Map(cuenta.plantas.map((p) => [p.id, p]));
  const veOportunidades = tienePermiso(sesion, "oportunidades.ver");
  const oportunidades = veOportunidades
    ? await oportunidadesDeCuenta(cuenta.id)
    : [];
  const equiposPorPlanta = await contarEquiposPorPlanta(
    cuenta.plantas.map((p) => p.id),
  );

  return (
    <>
      <title>{`${cuenta.nombre} · Sistema MOT`}</title>
      <PageHeader
        title={cuenta.nombre}
        description={cuenta.tipo_industria ?? undefined}
      >
        <Link
          href="/clientes"
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Clientes
        </Link>
        {editaClientes ? (
          <Link
            href={`${base}/editar`}
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            Editar
          </Link>
        ) : null}
      </PageHeader>

      {cuenta.notas ? (
        <p className="mb-6 max-w-3xl text-sm whitespace-pre-line text-muted-foreground">
          {cuenta.notas}
        </p>
      ) : null}

      <div className="space-y-8">
        <Seccion
          titulo="Plantas"
          vacio="Esta cuenta aún no tiene plantas."
          agregar={
            editaClientes
              ? { href: `${base}/plantas/nueva`, texto: "Agregar planta" }
              : null
          }
        >
          {cuenta.plantas.map((p) => {
            const razon = p.razon_social_id
              ? razonPorId.get(p.razon_social_id)
              : undefined;
            return (
              <Tarjeta key={p.id} href={`${base}/plantas/${p.id}`}>
                <p className="font-medium">{p.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {direccionPlanta(p) || "Sin dirección"}
                </p>
                {p.referencia ? (
                  <p className="text-sm text-muted-foreground">
                    {p.referencia}
                  </p>
                ) : null}
                <p className="text-sm">
                  <span className="text-muted-foreground">Se factura a: </span>
                  {razon ? razon.razon_social : "Sin definir"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {equiposPorPlanta.get(p.id) ?? 0} equipos
                </p>
              </Tarjeta>
            );
          })}
        </Seccion>

        <Seccion
          titulo="Razones sociales"
          vacio="Esta cuenta aún no tiene razones sociales."
          agregar={
            editaRazones
              ? {
                  href: `${base}/razones-sociales/nueva`,
                  texto: "Agregar razón social",
                }
              : null
          }
        >
          {cuenta.razonesSociales.map((r) => (
            <Tarjeta
              key={r.id}
              href={editaRazones ? `${base}/razones-sociales/${r.id}` : null}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{r.razon_social}</p>
                {r.usa_portal_proveedores ? (
                  <Badge variant="secondary">Portal de proveedores</Badge>
                ) : null}
              </div>
              <p className="font-mono text-sm">{r.rfc}</p>
              <p className="text-sm text-muted-foreground">
                {[
                  r.regimen_fiscal ? `Régimen ${r.regimen_fiscal}` : null,
                  r.codigo_postal_fiscal
                    ? `C.P. ${r.codigo_postal_fiscal}`
                    : null,
                  r.uso_cfdi ? `Uso CFDI ${r.uso_cfdi}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Faltan datos fiscales"}
              </p>
              {r.notas ? (
                <p className="text-sm text-muted-foreground">{r.notas}</p>
              ) : null}
            </Tarjeta>
          ))}
        </Seccion>

        <Seccion
          titulo="Contactos"
          vacio="Esta cuenta aún no tiene contactos."
          agregar={
            editaClientes
              ? { href: `${base}/contactos/nuevo`, texto: "Agregar contacto" }
              : null
          }
        >
          {cuenta.contactos.map((c) => {
            const planta = c.planta_id
              ? plantaPorId.get(c.planta_id)
              : undefined;
            return (
              <Tarjeta
                key={c.id}
                href={editaClientes ? `${base}/contactos/${c.id}` : null}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{c.nombre}</p>
                  <Badge variant="outline">{etiquetaArea(c.area)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {[c.puesto, planta ? planta.nombre : "Toda la cuenta"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-sm break-words">
                  {[c.telefono_celular, c.telefono_oficina, c.correo]
                    .filter(Boolean)
                    .join(" · ") || "Sin teléfono ni correo"}
                </p>
                {c.recibe_facturas || c.recibe_informes ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {c.recibe_facturas ? (
                      <Badge variant="secondary">Recibe facturas</Badge>
                    ) : null}
                    {c.recibe_informes ? (
                      <Badge variant="secondary">Recibe informes</Badge>
                    ) : null}
                  </div>
                ) : null}
                {c.notas ? (
                  <p className="text-sm text-muted-foreground">{c.notas}</p>
                ) : null}
              </Tarjeta>
            );
          })}
        </Seccion>

        {veOportunidades ? (
          <Seccion
            titulo="Oportunidades"
            vacio="Esta cuenta aún no tiene oportunidades."
            agregar={
              tienePermiso(sesion, "oportunidades.editar")
                ? {
                    href: `/oportunidades/nueva?cuenta=${cuenta.id}`,
                    texto: "Nueva oportunidad",
                  }
                : null
            }
          >
            {oportunidades.map((o) => (
              <Tarjeta key={o.id} href={`/oportunidades/${o.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{o.nombre}</p>
                  <Badge variant="secondary">{etiqueta(ETAPAS, o.etapa)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {o.plantas?.nombre ?? "Toda la cuenta"}
                </p>
              </Tarjeta>
            ))}
          </Seccion>
        ) : null}
      </div>
    </>
  );
}

type SeccionProps = {
  titulo: string;
  vacio: string;
  agregar: { href: string; texto: string } | null;
  children: ReactNode[];
};

function Seccion({ titulo, vacio, agregar, children }: SeccionProps) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          {titulo}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {children.length}
          </span>
        </h2>
        {agregar ? (
          <Link
            href={agregar.href}
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            {agregar.texto}
          </Link>
        ) : null}
      </div>
      {children.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          {vacio}
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">{children}</ul>
      )}
    </section>
  );
}

function Tarjeta({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  const tarjeta = (
    <Card
      className={`h-full gap-1 px-4 py-3 ${href ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""}`}
    >
      {children}
    </Card>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="block h-full">
          {tarjeta}
        </Link>
      ) : (
        tarjeta
      )}
    </li>
  );
}
