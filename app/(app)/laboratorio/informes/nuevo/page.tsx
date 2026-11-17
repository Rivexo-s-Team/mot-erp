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
import { camposInformeNuevo } from "@/lib/laboratorio/informe-campos";
import { listarCuentasParaElegir } from "@/lib/pipeline/data";
import { InformeForm } from "../informe-form";

export const metadata: Metadata = { title: "Nuevo informe" };

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

export default async function NuevoInformePage({
  searchParams,
}: PageProps<"/laboratorio/informes/nuevo">) {
  await requirePermiso("laboratorio.editar");
  const { cuenta: cuentaParam, equipo: equipoParam } = await searchParams;
  const cuentas = await listarCuentasParaElegir();

  if (typeof cuentaParam !== "string") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Nuevo informe"
          description="Elige de qué cliente es el equipo."
        />
        <Card>
          <CardContent>
            <form
              action="/laboratorio/informes/nuevo"
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

  const cuenta = esId(cuentaParam)
    ? cuentas.find((c) => c.id === cuentaParam)
    : undefined;
  if (!cuenta) notFound();

  const { equipos } = await opcionesMuestra(cuenta.id);
  const campos = camposInformeNuevo(equipos, hoyEnMexico());
  const valores = valoresIniciales(campos);
  const elegido =
    equipos.find((e) => e.value === equipoParam) ??
    (equipos.length === 1 ? equipos[0] : undefined);
  if (elegido) valores.equipo_cliente_id = elegido.value;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Nuevo informe" description={cuenta.nombre} />
      {equipos.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          Este cliente aún no tiene equipos registrados.
        </Card>
      ) : (
        <Card>
          <CardContent>
            <InformeForm
              modo={{ cuentaId: cuenta.id }}
              campos={campos}
              valores={valores}
              cancelarHref="/laboratorio/informes"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
