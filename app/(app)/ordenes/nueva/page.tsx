import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { camposOrden } from "@/lib/ordenes/campos";
import { opcionesOrden } from "@/lib/ordenes/data";
import { listarCuentasParaElegir } from "@/lib/pipeline/data";
import { OrdenForm } from "../orden-form";

export const metadata: Metadata = { title: "Nueva orden de servicio" };

export default async function NuevaOrdenPage({
  searchParams,
}: PageProps<"/ordenes/nueva">) {
  const sesion = await requirePermiso("ordenes.editar");
  const { cuenta: cuentaParam, tipo } = await searchParams;
  const esTaller = tipo === "taller";
  const cuentas = await listarCuentasParaElegir();

  // Paso 1: a qué cliente se visita, o si es un trabajo de taller.
  if (!esTaller && typeof cuentaParam !== "string") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Nueva orden de servicio"
          description="Elige el cliente que se va a visitar."
        />
        <Card>
          <CardContent>
            <form action="/ordenes/nueva" className="flex flex-col gap-4">
              <NativeSelect
                name="cuenta"
                aria-label="Cliente"
                required
                className="h-10 w-full"
              >
                <NativeSelectOption value="">
                  Elige un cliente…
                </NativeSelectOption>
                {cuentas.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.nombre}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/ordenes/nueva?tipo=taller"
                  className={buttonVariants({
                    variant: "ghost",
                    className: "h-10",
                  })}
                >
                  Es un trabajo de taller
                </Link>
                <Button type="submit" className="h-10">
                  Continuar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cuenta = esTaller
    ? null
    : z.uuid().safeParse(cuentaParam).success
      ? cuentas.find((c) => c.id === cuentaParam)
      : undefined;
  if (cuenta === undefined) notFound();

  const opciones = await opcionesOrden(cuenta?.id ?? null);
  const administra = tienePermiso(sesion, "ordenes.administrar");
  const campos = camposOrden(
    cuenta ? "visita" : "taller",
    opciones,
    hoyEnMexico(),
    administra,
    opciones.tecnicos.some((t) => t.value === sesion.id) ? sesion.id : "",
  );
  const valores = valoresIniciales(campos);
  if (opciones.plantas.length === 1 && opciones.plantas[0])
    valores.planta_id = opciones.plantas[0].value;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Nueva orden de servicio"
        description={cuenta ? cuenta.nombre : "Trabajo de taller"}
      />
      {cuenta && opciones.plantas.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          Este cliente aún no tiene plantas. Agrega una en su ficha antes de
          crear la orden.
        </Card>
      ) : (
        <Card>
          <CardContent>
            <OrdenForm
              cuentaId={cuenta?.id ?? null}
              ordenId={null}
              campos={campos}
              valores={valores}
              cancelarHref="/ordenes"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
