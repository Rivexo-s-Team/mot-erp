import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { centavosATexto } from "@/lib/cargos/campos";
import { rentasDelMes } from "@/lib/cargos/data";
import {
  desplazarMes,
  mesDeDia,
  nombreMes,
  periodoDeMes,
  rentasPorContrato,
  resumenRentas,
} from "@/lib/cargos/rentas";
import { formatImporte, hoyEnMexico } from "@/lib/format";
import { generarRentas } from "../actions";

export const metadata: Metadata = { title: "Rentas del mes" };

export default async function RentasPage({
  searchParams,
}: PageProps<"/cargos/rentas">) {
  const sesion = await requirePermiso("cargos.ver");
  if (!tienePermiso(sesion, "precios.ver")) redirect("/");
  const edita = tienePermiso(sesion, "cargos.editar");
  const { mes: mesParam, listo, error } = await searchParams;
  // Sin elegir, el mes en curso.
  const mes =
    typeof mesParam === "string" && periodoDeMes(mesParam)
      ? mesParam
      : mesDeDia(hoyEnMexico());
  const rentas = await rentasDelMes(`${mes}-01`);
  const resumen = resumenRentas(rentas);
  const grupos = rentasPorContrato(rentas);
  const total = resumen.totales
    .map((t) => formatImporte(centavosATexto(t.centavos), t.moneda))
    .join(" · ");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Rentas del mes"
        description="Un cargo por cada Robox rentado en los contratos vigentes. Quedan pendientes de facturar."
      >
        <Link
          href="/cargos"
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Cargos
        </Link>
      </PageHeader>

      <form
        action="/cargos/rentas"
        className="mb-4 flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Mes</span>
          <Input
            type="month"
            name="mes"
            defaultValue={mes}
            required
            className="h-10 w-44"
          />
        </label>
        <Button type="submit" variant="outline" className="h-10">
          Ver
        </Button>
        <Link
          href={`/cargos/rentas?mes=${desplazarMes(mes, -1)}`}
          className={buttonVariants({ variant: "ghost", className: "h-10" })}
        >
          Mes anterior
        </Link>
        <Link
          href={`/cargos/rentas?mes=${desplazarMes(mes, 1)}`}
          className={buttonVariants({ variant: "ghost", className: "h-10" })}
        >
          Mes siguiente
        </Link>
      </form>

      {listo ? (
        <Alert className="mb-4">
          <AlertDescription>
            Listo: las rentas de {nombreMes(mes)} ya están en Cargos por
            facturar.
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            No se pudieron generar las rentas. Intenta de nuevo.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="mb-4 gap-2 px-4 py-3">
        <p className="font-medium first-letter:uppercase">{nombreMes(mes)}</p>
        {rentas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún contrato vigente tiene rentas mensuales en este mes.
          </p>
        ) : resumen.porGenerar === 0 ? (
          <p className="text-sm text-muted-foreground">
            Las {resumen.generadas} rentas de este mes ya están generadas.
          </p>
        ) : (
          <>
            <p className="text-sm">
              <span className="text-muted-foreground">Por generar: </span>
              <span className="font-medium tabular-nums">
                {resumen.porGenerar}{" "}
                {resumen.porGenerar === 1 ? "renta" : "rentas"} · {total}
              </span>
              <span className="text-muted-foreground"> (sin IVA)</span>
              {resumen.generadas > 0 ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {resumen.generadas} ya generadas
                </span>
              ) : null}
            </p>
            {resumen.parciales > 0 ? (
              <p className="text-sm text-muted-foreground">
                {resumen.parciales === 1
                  ? "Un contrato empieza o termina"
                  : `${resumen.parciales} rentas son de contratos que empiezan o terminan`}{" "}
                dentro del mes: se cobra el mes completo y el cargo lo avisa
                para que lo revises.
              </p>
            ) : null}
            {edita ? (
              <form action={generarRentas.bind(null, mes)}>
                <Button type="submit" className="h-10">
                  Generar {resumen.porGenerar}{" "}
                  {resumen.porGenerar === 1 ? "cargo" : "cargos"} de renta
                </Button>
              </form>
            ) : null}
          </>
        )}
      </Card>

      <div className="space-y-4">
        {grupos.map((g) => (
          <section key={g.contratoId}>
            <h2 className="mb-2 text-sm font-medium">
              <Link
                href={`/contratos/${g.contratoId}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {g.titulo}
              </Link>
            </h2>
            <ul className="space-y-2">
              {g.rentas.map((r) => (
                <li key={r.tarifa_id}>
                  <Card className="gap-1 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm break-words">{r.concepto}</p>
                      <p className="font-medium tabular-nums">
                        {formatImporte(r.precio, r.moneda)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.cargo_id ? (
                        <Badge variant="outline">
                          {r.cargo_estado === "cancelado"
                            ? "Generada y cancelada"
                            : r.cargo_estado === "facturado"
                              ? "Facturada"
                              : "Ya generada"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Por generar</Badge>
                      )}
                      {r.parcial ? (
                        <Badge variant="outline">Mes incompleto</Badge>
                      ) : null}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
