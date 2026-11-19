import { ColumnaEtapa, TarjetaArrastrable } from "./tablero-arrastre";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { formatFecha } from "@/lib/format";
import {
  ETAPAS,
  ETAPAS_CERRADAS,
  etiqueta,
  TIPOS_CORTOS,
} from "@/lib/pipeline/campos";
import {
  directorioComercial,
  listarOportunidades,
  type Oportunidad,
} from "@/lib/pipeline/data";

export const metadata: Metadata = { title: "Oportunidades" };

export default async function OportunidadesPage({
  searchParams,
}: PageProps<"/oportunidades">) {
  const sesion = await requirePermiso("oportunidades.ver");
  const { ver, tipo: tipoParam } = await searchParams;
  const edita = tienePermiso(sesion, "oportunidades.editar");
  const cerradas = ver === "cerradas";
  const tipo = TIPOS_CORTOS.some((t) => t.value === tipoParam)
    ? (tipoParam as string)
    : undefined;
  const [oportunidades, { nombres }] = await Promise.all([
    listarOportunidades(cerradas ? "cerradas" : "tablero", tipo),
    directorioComercial(),
  ]);
  // El tablero lleva todo el proceso, hasta ganada y perdida.
  const columnas = cerradas
    ? ETAPAS.filter((e) => ETAPAS_CERRADAS.includes(e.value))
    : ETAPAS;
  const enlace = (t?: string) => {
    const q = new URLSearchParams();
    if (cerradas) q.set("ver", "cerradas");
    if (t) q.set("tipo", t);
    const texto = q.toString();
    return texto ? `/oportunidades?${texto}` : "/oportunidades";
  };

  return (
    <>
      <PageHeader
        title="Oportunidades"
        description={
          cerradas
            ? "Todas las ventas ganadas y perdidas."
            : edita
              ? "Ventas por etapa, hasta ganada o perdida. Arrastra una tarjeta para cambiarla de etapa."
              : "Ventas por etapa, hasta ganada o perdida."
        }
      >
        <Link
          href={cerradas ? "/oportunidades" : "/oportunidades?ver=cerradas"}
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          {cerradas ? "Ver tablero" : "Historial de cerradas"}
        </Link>
        {edita ? (
          <Link
            href="/oportunidades/nueva"
            className={buttonVariants({ className: "h-9" })}
          >
            Nueva oportunidad
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {[{ value: "", label: "Todas" }, ...TIPOS_CORTOS].map((t) => (
          <Link
            key={t.value}
            href={enlace(t.value || undefined)}
            className={buttonVariants({
              variant: (tipo ?? "") === t.value ? "default" : "outline",
              size: "sm",
              className: "h-8",
            })}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Celular: etapas una debajo de otra. Escritorio: columnas con desplazamiento horizontal. */}
      <div className="flex flex-col gap-4 lg:-mx-6 lg:flex-row lg:gap-2 lg:overflow-x-auto lg:px-6 lg:pb-4 xl:mx-0 xl:overflow-visible xl:px-0">
        {columnas.map((etapa) => {
          const tarjetas = oportunidades.filter((o) => o.etapa === etapa.value);
          return (
            <ColumnaEtapa
              key={etapa.value}
              etapa={etapa.value}
              nombre={etapa.label}
              activa={edita}
              className="lg:min-h-40 lg:w-56 lg:shrink-0 xl:w-auto xl:min-w-0 xl:flex-1 xl:shrink"
            >
              <h2
                className={`mb-2 flex items-end justify-between gap-2 border-b-2 pb-1.5 text-sm leading-tight font-semibold xl:min-h-11 ${etapa.value === "ganada" ? "border-exito text-exito" : etapa.value === "perdida" ? "border-muted-foreground/40 text-muted-foreground" : "border-primary/30"}`}
              >
                <span className="min-w-0 break-words">{etapa.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {tarjetas.length}
                </span>
              </h2>
              {tarjetas.length === 0 ? (
                <p className="hidden rounded-xl border border-dashed px-2 py-4 text-center text-xs text-muted-foreground lg:block">
                  —
                </p>
              ) : (
                <ul className="space-y-2">
                  {tarjetas.map((o) => (
                    <li key={o.id}>
                      <TarjetaArrastrable
                        id={o.id}
                        etapa={o.etapa}
                        activa={edita}
                      >
                        <TarjetaOportunidad
                          o={o}
                          responsable={nombres.get(o.responsable_id)}
                        />
                      </TarjetaArrastrable>
                    </li>
                  ))}
                </ul>
              )}
            </ColumnaEtapa>
          );
        })}
      </div>
    </>
  );
}

function TarjetaOportunidad({
  o,
  responsable,
}: {
  o: Oportunidad;
  responsable?: string;
}) {
  return (
    <Link href={`/oportunidades/${o.id}`} className="block" draggable={false}>
      <Card className="gap-1 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40">
        <p className="text-sm font-medium break-words">{o.nombre}</p>
        <p className="text-sm break-words text-muted-foreground">
          {o.cuentas.nombre}
          {o.plantas ? ` · ${o.plantas.nombre}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {responsable ?? "Sin responsable"}
          {o.volumen_estimado_l !== null ? ` · ${o.volumen_estimado_l} L` : ""}
        </p>
        <div className="flex flex-wrap gap-1 pt-0.5">
          {o.tipo !== "nuevo" ? (
            <Badge variant="secondary">{etiqueta(TIPOS_CORTOS, o.tipo)}</Badge>
          ) : null}
          {o.canales_venta ? (
            <Badge variant="outline" className="max-w-full justify-start">
              <span className="truncate">{o.canales_venta.nombre}</span>
            </Badge>
          ) : null}
          {o.etapa === "ganada" ? (
            <Badge variant="aviso" className="max-w-full justify-start">
              <span className="truncate">Pendiente de contrato</span>
            </Badge>
          ) : null}
          {o.fecha_cierre ? (
            <Badge variant="outline">{formatFecha(o.fecha_cierre)}</Badge>
          ) : null}
        </div>
        {o.etapa === "perdida" ? (
          <p className="text-xs text-muted-foreground">
            Motivo: {o.motivos_perdida?.nombre ?? o.motivo_perdida ?? "—"}
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
