import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { EstadoContratoBadge } from "@/components/contrato-estado-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resumenCredito } from "@/lib/facturacion/credito";
import {
  creditoDeCuenta,
  type CondicionesCredito,
} from "@/lib/facturacion/data";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { direccionPlanta, etiquetaArea } from "@/lib/clientes/campos";
import { contarEquiposPorPlanta, obtenerCuenta } from "@/lib/clientes/data";
import { textoVigencia } from "@/lib/contratos/campos";
import { listarContratos, nombreContrato } from "@/lib/contratos/data";
import { formatDia } from "@/lib/format";
import { ETAPAS, etiqueta } from "@/lib/pipeline/campos";
import { oportunidadesDeCuenta } from "@/lib/pipeline/data";
import { usuariosPortalDeCuenta } from "@/lib/portal/data";
import { cambiarAccesoPortal } from "../portal-actions";

export default async function CuentaPage({
  params,
}: PageProps<"/clientes/[id]">) {
  const sesion = await requirePermiso("clientes.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const cuenta = await obtenerCuenta(id);
  if (!cuenta) notFound();

  const veContratos = tienePermiso(sesion, "contratos.ver");
  const contratos = veContratos
    ? await listarContratos({ cuentaId: cuenta.id })
    : [];
  const editaClientes = tienePermiso(sesion, "clientes.editar");
  const editaRazones = tienePermiso(sesion, "razones_sociales.editar");
  const base = `/clientes/${cuenta.id}`;
  const razonPorId = new Map(cuenta.razonesSociales.map((r) => [r.id, r]));
  const plantaPorId = new Map(cuenta.plantas.map((p) => [p.id, p]));
  const veOportunidades = tienePermiso(sesion, "oportunidades.ver");
  const oportunidades = veOportunidades
    ? await oportunidadesDeCuenta(cuenta.id)
    : [];
  // Condiciones de crédito: solo para quien ve facturación.
  const veFacturacion = tienePermiso(sesion, "facturacion.ver");
  const editaFacturacion = tienePermiso(sesion, "facturacion.editar");
  const credito = veFacturacion ? await creditoDeCuenta(cuenta.id) : null;
  // Acceso al portal: lo administra quien administra usuarios.
  const administraUsuarios = tienePermiso(sesion, "usuarios.administrar");
  const usuariosPortal = administraUsuarios
    ? await usuariosPortalDeCuenta(cuenta.id)
    : [];
  const equiposPorPlanta = await contarEquiposPorPlanta(
    cuenta.plantas.map((p) => p.id),
  );

  return (
    <>
      <title>{`${cuenta.nombre} · Sistema MOT`}</title>
      <PageHeader
        migas={[{ label: "Clientes", href: "/clientes" }]}
        title={cuenta.nombre}
        description={cuenta.tipo_industria ?? undefined}
      >
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
            <div key={r.id} className="flex flex-col gap-1.5">
              <Tarjeta
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
              {credito ? (
                <CreditoRazon
                  credito={credito.get(r.id)}
                  href={
                    editaFacturacion
                      ? `${base}/razones-sociales/${r.id}/credito`
                      : null
                  }
                />
              ) : null}
            </div>
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

        {veContratos ? (
          <Seccion
            titulo="Contratos"
            vacio="Esta cuenta aún no tiene contratos."
            agregar={
              tienePermiso(sesion, "contratos.editar")
                ? {
                    href: `/contratos/nuevo?cuenta=${cuenta.id}`,
                    texto: "Nuevo contrato",
                  }
                : null
            }
          >
            {contratos.map((c) => (
              <Tarjeta key={c.id} href={`/contratos/${c.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">
                    {nombreContrato(c)}
                    {c.referencia ? ` · ${c.referencia}` : ""}
                  </p>
                  <EstadoContratoBadge estado={c.estado} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {textoVigencia(c.fecha_inicio, c.fecha_termino, formatDia)}
                </p>
              </Tarjeta>
            ))}
          </Seccion>
        ) : null}

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

        {administraUsuarios ? (
          <Seccion
            titulo="Acceso al portal"
            vacio="Nadie de este cliente tiene acceso al portal."
            agregar={{ href: `${base}/portal/nuevo`, texto: "Dar acceso" }}
          >
            {usuariosPortal.map((u) => (
              <Tarjeta key={u.id} href={null}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{u.nombre}</p>
                  <Badge variant={u.activo ? "exito" : "neutro"}>
                    {u.activo ? "Activo" : "Sin acceso"}
                  </Badge>
                </div>
                <p className="text-sm break-all text-muted-foreground">
                  {u.correo}
                </p>
                {u.puesto ? <p className="text-sm">{u.puesto}</p> : null}
                <form
                  action={cambiarAccesoPortal.bind(
                    null,
                    cuenta.id,
                    u.id,
                    !u.activo,
                  )}
                  className="pt-1"
                >
                  <Button type="submit" variant="outline" size="sm">
                    {u.activo ? "Quitar acceso" : "Reactivar acceso"}
                  </Button>
                </form>
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

/** Condiciones de crédito de una razón social, bajo su tarjeta. */
function CreditoRazon({
  credito,
  href,
}: {
  credito: CondicionesCredito | undefined;
  href: string | null;
}) {
  return (
    <p className="px-1 text-sm">
      <span className="text-muted-foreground">Crédito: </span>
      {credito ? resumenCredito(credito) : "sin definir"}
      {credito?.contactos ? (
        <span className="text-muted-foreground">
          {" "}
          · cuentas por pagar: {credito.contactos.nombre}
        </span>
      ) : null}
      {credito?.portal ? (
        <span className="text-muted-foreground">
          {" "}
          · portal: {credito.portal}
        </span>
      ) : null}
      {href ? (
        <>
          {" · "}
          <Link
            href={href}
            className="text-primary underline-offset-4 hover:underline"
          >
            {credito ? "Cambiar" : "Capturar"}
          </Link>
        </>
      ) : null}
    </p>
  );
}
