import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { requirePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { opcionesMuestra } from "@/lib/laboratorio/data";
import { camposMuestra } from "@/lib/laboratorio/muestras";
import { obtenerOrden } from "@/lib/ordenes/data";
import {
  listarCuentasParaElegir,
  obtenerOportunidad,
} from "@/lib/pipeline/data";
import { MuestraForm } from "../muestra-form";

export const metadata: Metadata = { title: "Nueva muestra" };

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

export default async function NuevaMuestraPage({
  searchParams,
}: PageProps<"/laboratorio/muestras/nueva">) {
  await requirePermiso("laboratorio.editar");
  const {
    cuenta: cuentaParam,
    orden: ordenParam,
    oportunidad: oportunidadParam,
  } = await searchParams;

  // Si se llega desde una orden o una oportunidad, el cliente ya se conoce.
  const orden = esId(ordenParam) ? await obtenerOrden(ordenParam) : null;
  if (ordenParam !== undefined && !orden?.cuenta_id) notFound();
  const oportunidad = esId(oportunidadParam)
    ? await obtenerOportunidad(oportunidadParam)
    : null;
  if (oportunidadParam !== undefined && !oportunidad) notFound();

  const cuentas = await listarCuentasParaElegir();
  const cuentaId = orden?.cuenta_id ?? oportunidad?.cuenta_id ?? cuentaParam;

  if (typeof cuentaId !== "string") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Nueva muestra"
          description="Elige de qué cliente es el aceite."
        />
        <Card>
          <CardContent>
            <form
              action="/laboratorio/muestras/nueva"
              className="flex flex-col gap-4"
            >
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

  const cuenta = esId(cuentaId)
    ? cuentas.find((c) => c.id === cuentaId)
    : undefined;
  if (!cuenta) notFound();

  const opciones = await opcionesMuestra(cuenta.id);
  const campos = camposMuestra(false, opciones, hoyEnMexico());
  const valores = valoresIniciales(campos);
  const unico = opciones.equipos.length === 1 ? opciones.equipos[0] : null;
  if (unico) valores.equipo_cliente_id = unico.value;
  if (orden) {
    if ("orden_id" in valores) valores.orden_id = orden.id;
    if (orden.equipo_cliente_id)
      valores.equipo_cliente_id = orden.equipo_cliente_id;
    if (orden.fecha_real) valores.fecha_muestreo = orden.fecha_real;
  }
  if (oportunidad && "oportunidad_id" in valores)
    valores.oportunidad_id = oportunidad.id;

  const volver = orden
    ? `/ordenes/${orden.id}`
    : oportunidad
      ? `/oportunidades/${oportunidad.id}`
      : "/laboratorio/muestras";

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Nueva muestra"
        description={
          orden ? `${cuenta.nombre} · orden ${orden.folio}` : cuenta.nombre
        }
      />
      {opciones.equipos.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          Este cliente aún no tiene equipos registrados. Agrega el equipo o
          tanque en la ficha de su planta antes de registrar la muestra.
        </Card>
      ) : (
        <Card>
          <CardContent>
            <MuestraForm
              cuentaId={cuenta.id}
              muestraId={null}
              campos={campos}
              valores={valores}
              cancelarHref={volver}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
