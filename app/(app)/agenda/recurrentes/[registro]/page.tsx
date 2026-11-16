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
import { camposVisita } from "@/lib/agenda/campos";
import { obtenerVisita } from "@/lib/agenda/data";
import { requirePermiso } from "@/lib/auth/session";
import {
  equiposDePlanta,
  listarContratos,
  nombreContrato,
  obtenerContrato,
} from "@/lib/contratos/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { opcionesOrden } from "@/lib/ordenes/data";
import { eliminarVisita, guardarVisita } from "../../actions";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

export default async function VisitaRecurrentePage({
  params,
  searchParams,
}: PageProps<"/agenda/recurrentes/[registro]">) {
  await requirePermiso("ordenes.editar");
  const { registro } = await params;
  const { contrato: contratoParam } = await searchParams;
  const esNueva = registro === "nueva";

  const visita = esNueva
    ? null
    : esId(registro)
      ? await obtenerVisita(registro)
      : null;
  if (!esNueva && !visita) notFound();
  const contratoId = visita?.contrato_id ?? contratoParam;

  // Paso 1 (solo al crear): de qué contrato es la visita.
  if (typeof contratoId !== "string") {
    const contratos = (await listarContratos({}))
      .filter((c) => c.estado === "borrador" || c.estado === "vigente")
      .map((c) => ({
        id: c.id,
        nombre: `${c.cuentas.nombre} · ${nombreContrato(c)}${c.referencia ? ` · ${c.referencia}` : ""}`,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Nueva visita recurrente"
          description="Elige el contrato al que pertenece."
        />
        <Card>
          <CardContent>
            {contratos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay contratos en borrador o vigentes.
              </p>
            ) : (
              <form
                action="/agenda/recurrentes/nueva"
                className="flex flex-col gap-4"
              >
                <NativeSelect
                  name="contrato"
                  aria-label="Contrato"
                  required
                  className="h-10 w-full"
                >
                  <NativeSelectOption value="">
                    Elige un contrato…
                  </NativeSelectOption>
                  {contratos.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.nombre}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button type="submit" className="h-10 sm:self-end">
                  Continuar
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const contrato = esId(contratoId) ? await obtenerContrato(contratoId) : null;
  if (!contrato) notFound();

  const [equipos, opciones] = await Promise.all([
    equiposDePlanta(contrato.planta_id),
    opcionesOrden(null),
  ]);
  const campos = camposVisita(
    equipos,
    opciones.robox,
    opciones.tecnicos,
    hoyEnMexico(),
  );
  const titulo = esNueva
    ? "Nueva visita recurrente"
    : "Editar visita recurrente";

  return (
    <div className="mx-auto max-w-xl">
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader
        title={titulo}
        description={`${contrato.cuentas.nombre} · ${nombreContrato(contrato)}`}
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={campos}
            valores={valoresIniciales(
              campos,
              visita
                ? {
                    cada_cantidad: visita.cada_cantidad,
                    cada_unidad: visita.cada_unidad,
                    proxima_fecha: visita.proxima_fecha,
                    equipo_cliente_id: visita.equipo_cliente_id,
                    robox_id: visita.robox_id,
                    tecnico_id: visita.tecnico_id,
                    activa: visita.activa,
                    notas: visita.notas,
                  }
                : undefined,
            )}
            esEdicion={!esNueva}
            guardar={guardarVisita.bind(null, contrato.id, visita?.id ?? null)}
            cancelarHref="/agenda"
            textoGuardar={
              esNueva ? "Crear visita recurrente" : "Guardar cambios"
            }
            eliminar={
              visita
                ? eliminarVisita.bind(null, contrato.id, visita.id)
                : undefined
            }
            confirmarEliminar="¿Eliminar esta visita recurrente? Las órdenes que ya nacieron de ella se conservan. Si solo quieres pausarla, quítale la marca de Activa."
          />
        </CardContent>
      </Card>
    </div>
  );
}
