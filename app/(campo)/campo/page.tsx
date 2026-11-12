import type { Metadata } from "next";
import Link from "next/link";
import { EstadoOrdenBadge } from "@/components/orden-estado-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia, hoyEnMexico } from "@/lib/format";
import { listarOrdenes, lugarOrden } from "@/lib/ordenes/data";

export const metadata: Metadata = { title: "Mis órdenes" };

export default async function CampoPage() {
  const sesion = await requirePermiso("ordenes.editar");
  // Las órdenes abiertas donde voy como técnico o acompañante, la más próxima primero.
  const ordenes = await listarOrdenes({ personaId: sesion.id, abiertas: true });
  const hoy = hoyEnMexico();

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis órdenes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{sesion.nombre}</p>
        </div>
        <Link
          href="/ordenes/nueva"
          className={buttonVariants({ className: "h-10" })}
        >
          Nueva orden
        </Link>
      </div>

      {ordenes.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          No tienes órdenes programadas ni en curso.
        </Card>
      ) : (
        <ul className="space-y-3">
          {ordenes.map((o) => (
            <li key={o.id}>
              <Link href={`/campo/ordenes/${o.id}`} className="block">
                <Card className="gap-1.5 px-4 py-4 transition-colors active:bg-accent/60">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-lg font-semibold">{lugarOrden(o)}</p>
                    <EstadoOrdenBadge estado={o.estado} />
                  </div>
                  <p className="text-sm">
                    {o.equipos_cliente
                      ? `Equipo ${nombreEquipo(o.equipos_cliente)}`
                      : "Equipo sin definir"}
                    {o.robox ? ` · Robox ${o.robox.numero_serie}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {o.fecha_programada === hoy
                      ? "Hoy"
                      : formatDia(o.fecha_programada)}
                    {o.fecha_programada < hoy && o.estado === "programada"
                      ? " (atrasada)"
                      : ""}{" "}
                    · Folio {o.folio}
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
