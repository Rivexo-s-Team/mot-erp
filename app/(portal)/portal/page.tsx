import type { Metadata } from "next";
import Link from "next/link";
import { FileText, FlaskConical, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { requireSesionPortal } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia, formatImporte, hoyEnMexico } from "@/lib/format";
import { CONDICIONES } from "@/lib/laboratorio/evaluacion";
import {
  facturasDelPortal,
  informesDelPortal,
  ordenesDelPortal,
} from "@/lib/portal/data";
import { saldosPorMoneda } from "@/lib/portal/facturas";
import { CondicionBadge } from "./informes/condicion-badge";

export const metadata: Metadata = { title: "Portal de clientes" };

export default async function PortalPage() {
  const sesion = await requireSesionPortal();
  const [informes, facturas, ordenes] = await Promise.all([
    informesDelPortal(),
    facturasDelPortal(),
    ordenesDelPortal(),
  ]);
  const saldos = saldosPorMoneda(facturas, hoyEnMexico());
  const informe = informes[0];
  const orden = ordenes[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {sesion.cuenta.nombre}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hola, {sesion.nombre}. Este es el resumen de tu empresa con Molecular
          Oil Technology.
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        <Tarjeta
          icono={<FlaskConical aria-hidden className="size-5 text-primary" />}
          titulo="Laboratorio"
          href="/portal/informes"
          accion={
            informes.length === 1
              ? "Ver el informe"
              : `Ver los ${informes.length} informes`
          }
          vacio={informe ? null : "Aún no hay informes publicados."}
        >
          {informe ? (
            <>
              <p className="text-sm text-muted-foreground">Último informe</p>
              <p className="font-medium">
                {nombreEquipo({
                  identificador: informe.equipo,
                  alias: informe.equipo_alias,
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {informe.planta} · {formatDia(informe.fecha_emision)}
              </p>
              {informe.condicion_general in CONDICIONES ? (
                <div>
                  <CondicionBadge
                    condicion={
                      informe.condicion_general as keyof typeof CONDICIONES
                    }
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </Tarjeta>

        <Tarjeta
          icono={<FileText aria-hidden className="size-5 text-primary" />}
          titulo="Facturas y pagos"
          href="/portal/facturas"
          accion="Ver facturas y pagos"
          vacio={facturas.length === 0 ? "Aún no hay facturas." : null}
        >
          {facturas.length === 0 ? null : saldos.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">Saldo por pagar</p>
              <p className="font-medium">Sin saldo pendiente</p>
            </>
          ) : (
            saldos.map((s) => (
              <div key={s.moneda}>
                <p className="text-sm text-muted-foreground">
                  Saldo por pagar · {s.facturas}{" "}
                  {s.facturas === 1 ? "factura" : "facturas"}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatImporte(s.saldo, s.moneda)}
                </p>
                {s.vencido > 0 ? (
                  <p className="text-sm text-destructive tabular-nums">
                    Vencido: {formatImporte(s.vencido, s.moneda)}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </Tarjeta>

        <Tarjeta
          icono={<Wrench aria-hidden className="size-5 text-primary" />}
          titulo="Órdenes de servicio"
          href="/portal/ordenes"
          accion={
            ordenes.length === 1
              ? "Ver la visita"
              : `Ver las ${ordenes.length} visitas`
          }
          vacio={orden ? null : "Aún no hay visitas concluidas."}
        >
          {orden ? (
            <>
              <p className="text-sm text-muted-foreground">Última visita</p>
              <p className="font-medium">{formatDia(orden.fecha)}</p>
              <p className="text-sm text-muted-foreground">
                {orden.planta}
                {orden.equipo
                  ? ` · ${nombreEquipo({ identificador: orden.equipo, alias: orden.equipo_alias })}`
                  : ""}
              </p>
            </>
          ) : null}
        </Tarjeta>
      </ul>
    </div>
  );
}

/** Tarjeta de una sección: lo más reciente y el enlace a todo lo demás. */
function Tarjeta({
  icono,
  titulo,
  href,
  accion,
  vacio,
  children,
}: {
  icono: ReactNode;
  titulo: string;
  href: string;
  accion: string;
  /** Texto cuando la sección aún no tiene nada; entonces no se ofrece el enlace. */
  vacio: string | null;
  children: ReactNode;
}) {
  const contenido = (
    <Card
      className={`h-full gap-2 px-4 py-4 ${vacio ? "" : "transition-colors hover:border-primary/40 hover:bg-accent/40"}`}
    >
      <p className="flex items-center gap-2 font-medium">
        {icono}
        {titulo}
      </p>
      {vacio ? (
        <p className="text-sm text-muted-foreground">{vacio}</p>
      ) : (
        <>
          <div className="flex-1 space-y-1">{children}</div>
          <p className="text-sm font-medium text-primary">{accion}</p>
        </>
      )}
    </Card>
  );
  return (
    <li>
      {vacio ? (
        contenido
      ) : (
        <Link href={href} className="block h-full">
          {contenido}
        </Link>
      )}
    </li>
  );
}
