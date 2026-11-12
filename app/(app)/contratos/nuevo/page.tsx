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
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { camposContrato } from "@/lib/contratos/campos";
import {
  contratoDeOportunidad,
  contratosParaOrigen,
  cotizacionAceptada,
  razonesSocialesDeCuenta,
} from "@/lib/contratos/data";
import { valoresIniciales } from "@/lib/forms/campos";
import {
  listarCuentasParaElegir,
  obtenerOportunidad,
  plantasDeCuenta,
} from "@/lib/pipeline/data";
import { ContratoForm } from "../contrato-form";

export const metadata: Metadata = { title: "Nuevo contrato" };

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

export default async function NuevoContratoPage({
  searchParams,
}: PageProps<"/contratos/nuevo">) {
  const sesion = await requirePermiso("contratos.editar");
  const { cuenta: cuentaParam, oportunidad: oportunidadParam } =
    await searchParams;

  // Desde una oportunidad ganada: la cuenta, la planta y los precios ya existen.
  let oportunidad: Awaited<ReturnType<typeof obtenerOportunidad>> = null;
  let cotizacion: Awaited<ReturnType<typeof cotizacionAceptada>> = null;
  if (oportunidadParam !== undefined) {
    if (!esId(oportunidadParam) || !tienePermiso(sesion, "oportunidades.ver"))
      notFound();
    oportunidad = await obtenerOportunidad(oportunidadParam);
    if (!oportunidad || oportunidad.etapa !== "ganada") notFound();
    if (await contratoDeOportunidad(oportunidad.id)) notFound();
    if (tienePermiso(sesion, "precios.ver"))
      cotizacion = await cotizacionAceptada(oportunidad.id);
  }

  const cuentas = await listarCuentasParaElegir();
  const cuentaId = oportunidad?.cuenta_id ?? cuentaParam;

  // Paso 1: elegir el cliente.
  if (typeof cuentaId !== "string") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Nuevo contrato"
          description="Primero elige el cliente. Su planta ya debe estar en su ficha."
        />
        <Card>
          <CardContent>
            <form action="/contratos/nuevo" className="flex flex-col gap-4">
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

  const [plantas, razones, origenes] = await Promise.all([
    plantasDeCuenta(cuenta.id),
    razonesSocialesDeCuenta(cuenta.id),
    contratosParaOrigen(cuenta.id),
  ]);
  const campos = camposContrato(
    plantas,
    razones,
    origenes,
    cotizacion?.moneda ?? "USD",
  );
  const valores = valoresIniciales(campos);
  if (oportunidad?.planta_id) valores.planta_id = oportunidad.planta_id;
  else if (plantas.length === 1 && plantas[0])
    valores.planta_id = plantas[0].value;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Nuevo contrato" description={cuenta.nombre} />
      {oportunidad ? (
        <Card className="mb-4 gap-1 px-4 py-3 text-sm">
          <p className="font-medium">De la oportunidad: {oportunidad.nombre}</p>
          <p className="text-muted-foreground">
            {cotizacion
              ? `Al crearlo se copian como tarifas las ${cotizacion.partidas.length} partidas de la cotización aceptada ${cotizacion.folio}. Después las puedes ajustar.`
              : "No hay una cotización aceptada: las tarifas se capturan después, en la ficha del contrato."}
          </p>
        </Card>
      ) : null}
      {plantas.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          Este cliente aún no tiene plantas. Agrega una en su ficha antes de
          crear el contrato.
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ContratoForm
              cuentaId={cuenta.id}
              contratoId={null}
              oportunidadId={oportunidad?.id ?? null}
              campos={campos}
              valores={valores}
              cancelarHref={
                oportunidad ? `/oportunidades/${oportunidad.id}` : "/contratos"
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
