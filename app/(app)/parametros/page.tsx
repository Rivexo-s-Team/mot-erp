import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { formatFecha } from "@/lib/format";
import { describirValor } from "@/lib/parametros/campos";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Parámetros de negocio" };

export default async function ParametrosPage() {
  const sesion = await requirePermiso("parametros.ver");
  const supabase = await createClient();
  const { data: parametros, error } = await supabase
    .from("parametros_negocio")
    .select("clave, valor, unidad, moneda, descripcion, updated_at")
    .order("clave");
  if (error) throw new Error("No se pudieron cargar los parámetros.");
  const edita = tienePermiso(sesion, "parametros.editar");

  return (
    <>
      <PageHeader
        title="Parámetros de negocio"
        description="Valores de política comercial y de laboratorio. Cada cambio queda en la bitácora."
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {parametros.map((p) => (
          <li key={p.clave}>
            <Card className="h-full gap-2 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-lg font-semibold tabular-nums">
                  {describirValor(p)}
                </p>
                {edita ? (
                  <Link
                    href={`/parametros/${p.clave}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Cambiar
                  </Link>
                ) : null}
              </div>
              <p className="text-sm">{p.descripcion}</p>
              <p className="text-xs text-muted-foreground">
                Último cambio: {formatFecha(p.updated_at)}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
