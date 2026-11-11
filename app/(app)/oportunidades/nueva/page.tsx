import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { requirePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { camposOportunidad } from "@/lib/pipeline/campos";
import {
  directorioComercial,
  listarCanalesActivos,
  listarCuentasParaElegir,
  plantasDeCuenta,
} from "@/lib/pipeline/data";
import { guardarOportunidad } from "../actions";

export const metadata: Metadata = { title: "Nueva oportunidad" };

export default async function NuevaOportunidadPage({
  searchParams,
}: PageProps<"/oportunidades/nueva">) {
  const sesion = await requirePermiso("oportunidades.editar");
  const { cuenta: cuentaId } = await searchParams;
  const cuentas = await listarCuentasParaElegir();

  // Paso 1: elegir la cuenta. La cuenta, la planta y los equipos no se recapturan.
  if (typeof cuentaId !== "string") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Nueva oportunidad"
          description="Primero elige el cliente. Si es un prospecto nuevo, créalo antes en Clientes."
        />
        <Card>
          <CardContent>
            <form action="/oportunidades/nueva" className="flex flex-col gap-4">
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
              <Button type="submit" className="h-10 sm:self-end">
                Continuar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cuenta = z.uuid().safeParse(cuentaId).success
    ? cuentas.find((c) => c.id === cuentaId)
    : undefined;
  if (!cuenta) notFound();

  const [plantas, { asignables }, canales] = await Promise.all([
    plantasDeCuenta(cuenta.id),
    directorioComercial(),
    listarCanalesActivos(),
  ]);
  const campos = camposOportunidad(plantas, asignables, canales);
  const valores = valoresIniciales(campos);
  // Quien la captura queda de responsable, si puede serlo.
  if (asignables.some((r) => r.value === sesion.id))
    valores.responsable_id = sesion.id;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Nueva oportunidad" description={cuenta.nombre} />
      <Card>
        <CardContent>
          <ConfigForm
            campos={campos}
            valores={valores}
            esEdicion={false}
            guardar={guardarOportunidad.bind(null, cuenta.id, null)}
            cancelarHref="/oportunidades"
            textoGuardar="Crear oportunidad"
          />
        </CardContent>
      </Card>
    </div>
  );
}
