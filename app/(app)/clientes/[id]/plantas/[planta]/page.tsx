import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import {
  direccionPlanta,
  etiquetaCategoria,
  TOMA_MUESTRAS,
} from "@/lib/clientes/campos";
import { obtenerPlanta, type PlantaCompleta } from "@/lib/clientes/data";
import { formatImporte } from "@/lib/format";

export default async function PlantaPage({
  params,
}: PageProps<"/clientes/[id]/plantas/[planta]">) {
  const sesion = await requirePermiso("clientes.ver");
  const { id, planta: plantaId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(plantaId).success)
    notFound();
  const planta = await obtenerPlanta(id, plantaId);
  if (!planta) notFound();

  const edita = tienePermiso(sesion, "clientes.editar");
  const base = `/clientes/${id}/plantas/${planta.id}`;

  return (
    <>
      <title>{`${planta.nombre} · ${planta.cuenta.nombre} · Sistema MOT`}</title>
      <PageHeader title={planta.nombre} description={planta.cuenta.nombre}>
        <Link
          href={`/clientes/${id}`}
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          {planta.cuenta.nombre}
        </Link>
        {edita ? (
          <Link
            href={`${base}/editar`}
            className={buttonVariants({ variant: "outline", className: "h-9" })}
          >
            Editar
          </Link>
        ) : null}
      </PageHeader>

      <dl className="mb-8 grid max-w-3xl gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <Dato titulo="Dirección">
          {direccionPlanta(planta) || "Sin dirección"}
        </Dato>
        {planta.referencia ? (
          <Dato titulo="Referencias">{planta.referencia}</Dato>
        ) : null}
        <Dato titulo="Se factura a">
          {planta.razones_sociales?.razon_social ?? "Sin definir"}
        </Dato>
      </dl>

      <div className="space-y-8">
        <Seccion
          titulo="Equipos"
          total={planta.equipos.length}
          vacio="Esta planta aún no tiene equipos."
          agregar={
            edita
              ? { href: `${base}/equipos/nuevo`, texto: "Agregar equipo" }
              : null
          }
        >
          {planta.equipos.map((e) => (
            <Tarjeta key={e.id} href={edita ? `${base}/equipos/${e.id}` : null}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">
                  {e.identificador}
                  {e.alias ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {e.alias}
                    </span>
                  ) : null}
                </p>
                {e.volumen_reservorio_l !== null ? (
                  <Badge variant="secondary">{e.volumen_reservorio_l} L</Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {[e.aplicacion, e.marca].filter(Boolean).join(" · ") ||
                  "Sin aplicación registrada"}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 pt-1 text-sm">
                {datosEquipo(e).map(([titulo, valor]) => (
                  <div key={titulo} className="contents">
                    <dt className="text-muted-foreground">{titulo}</dt>
                    <dd className="min-w-0 break-words">{valor}</dd>
                  </div>
                ))}
              </dl>
              {e.notas ? (
                <p className="pt-1 text-sm text-muted-foreground">{e.notas}</p>
              ) : null}
            </Tarjeta>
          ))}
        </Seccion>

        <Seccion
          titulo="Requisitos de la planta"
          total={planta.requisitos.length}
          vacio="Aún no hay requisitos registrados para esta planta."
          agregar={
            edita
              ? { href: `${base}/requisitos/nuevo`, texto: "Agregar requisito" }
              : null
          }
        >
          {planta.requisitos.map((r) => (
            <Tarjeta
              key={r.id}
              href={edita ? `${base}/requisitos/${r.id}` : null}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{r.nombre}</p>
                <Badge variant="outline">
                  {etiquetaCategoria(r.categoria)}
                </Badge>
              </div>
              {r.detalle ? (
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {r.detalle}
                </p>
              ) : null}
            </Tarjeta>
          ))}
        </Seccion>
      </div>
    </>
  );
}

/** Datos del equipo que sí están capturados, en el orden del levantamiento. */
function datosEquipo(e: PlantaCompleta["equipos"][number]): [string, string][] {
  const contenedores =
    e.numero_contenedores !== null
      ? `${e.numero_contenedores}${e.volumen_contenedor_l !== null ? ` de ${e.volumen_contenedor_l} L` : ""}`
      : null;
  const datos: [string, string | null][] = [
    [
      "Aceite",
      e.aceites ? `${e.aceites.marca} ${e.aceites.nombre_comercial}` : null,
    ],
    ["Contenedores", contenedores],
    ["Conexión", e.tipo_conexion],
    ["Altura", e.altura],
    ["Localización", e.localizacion],
    [
      "Temperatura",
      e.temperatura_operacion_c !== null
        ? `${e.temperatura_operacion_c} °C`
        : null,
    ],
    ["Cambio de aceite", e.frecuencia_cambio_aceite],
    [
      "Toma muestras",
      TOMA_MUESTRAS.find((o) => o.value === e.toma_muestras)?.label ?? null,
    ],
    // Solo llega a quien puede ver precios.
    [
      "Aceite virgen",
      e.costo
        ? `${formatImporte(e.costo.costo_aceite_virgen, e.costo.moneda)} por litro`
        : null,
    ],
  ];
  return datos.filter(
    (d): d is [string, string] => d[1] !== null && d[1] !== "",
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{titulo}</dt>
      <dd className="mb-2 sm:mb-0">{children}</dd>
    </div>
  );
}

type SeccionProps = {
  titulo: string;
  total: number;
  vacio: string;
  agregar: { href: string; texto: string } | null;
  children: ReactNode;
};

function Seccion({ titulo, total, vacio, agregar, children }: SeccionProps) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          {titulo}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {total}
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
      {total === 0 ? (
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
