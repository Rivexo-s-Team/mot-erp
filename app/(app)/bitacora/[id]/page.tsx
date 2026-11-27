import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import {
  cambiosDe,
  direccion,
  nombreCampo,
  nombreOperacion,
  nombreTabla,
  textoValor,
} from "@/lib/bitacora/cambios";
import { nombresDeUsuarios, obtenerRenglon } from "@/lib/bitacora/data";
import { formatFechaHora } from "@/lib/format";

export default async function RenglonBitacoraPage({
  params,
}: PageProps<"/bitacora/[id]">) {
  await requirePermiso("bitacora.ver");
  const { id } = await params;
  const r = z.uuid().safeParse(id).success ? await obtenerRenglon(id) : null;
  if (!r) notFound();
  const nombres = await nombresDeUsuarios();
  const cambios = cambiosDe(r);
  const esCambio = r.operacion === "UPDATE";
  const datos: [string, string][] = [
    ["Fecha", formatFechaHora(r.created_at)],
    [
      "Quién",
      r.usuario_id
        ? (nombres.get(r.usuario_id) ?? "Usuario dado de baja")
        : "Sistema",
    ],
    ["Dónde", nombreTabla(r.tabla)],
    ["Qué", nombreOperacion(r.operacion)],
  ];

  return (
    <>
      <title>{`${nombreOperacion(r.operacion)} en ${nombreTabla(r.tabla)} · Sistema MOT`}</title>
      <PageHeader
        migas={[{ label: "Bitácora", href: "/bitacora" }]}
        title={`${nombreOperacion(r.operacion)} en ${nombreTabla(r.tabla)}`}
        description={formatFechaHora(r.created_at)}
      >
        <Link
          href={direccion({ registro: r.registro_id })}
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Historial de este registro
        </Link>
      </PageHeader>

      <div className="space-y-6">
        <Card className="max-w-xl">
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              {datos.map(([nombre, valor]) => (
                <div key={nombre} className="contents">
                  <dt className="text-muted-foreground">{nombre}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {esCambio
                ? "Qué cambió"
                : r.operacion === "DELETE"
                  ? "Lo que había"
                  : "Lo que se registró"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {cambios.length} {cambios.length === 1 ? "campo" : "campos"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cambios.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin cambios visibles.
              </p>
            ) : (
              <dl className="divide-y text-sm">
                {cambios.map((c) => (
                  <div
                    key={c.campo}
                    className="grid gap-x-6 gap-y-1 py-2 sm:grid-cols-[12rem_1fr]"
                  >
                    <dt className="font-medium">{nombreCampo(c.campo)}</dt>
                    <dd className="min-w-0 break-words whitespace-pre-wrap">
                      {esCambio ? (
                        <>
                          <span className="text-muted-foreground line-through">
                            {textoValor(c.antes, 600, nombres)}
                          </span>
                          <span aria-hidden className="text-muted-foreground">
                            {" → "}
                          </span>
                          <span className="sr-only"> cambió a </span>
                          {textoValor(c.despues, 600, nombres)}
                        </>
                      ) : (
                        textoValor(c.antes ?? c.despues, 600, nombres)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
