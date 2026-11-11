import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { camposActividad } from "@/lib/pipeline/campos";
import { directorioComercial, obtenerOportunidad } from "@/lib/pipeline/data";
import { eliminarActividad, guardarActividad } from "../../../actions";

export default async function ActividadPage({
  params,
}: PageProps<"/oportunidades/[id]/actividades/[registro]">) {
  const sesion = await requirePermiso("oportunidades.editar");
  const { id, registro } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const o = await obtenerOportunidad(id);
  if (!o) notFound();

  const esNueva = registro === "nueva";
  const actividad = esNueva
    ? undefined
    : o.actividades.find((a) => a.id === registro);
  if (!esNueva && !actividad) notFound();

  const { asignables, nombres } = await directorioComercial();
  const responsables =
    actividad && !asignables.some((r) => r.value === actividad.responsable_id)
      ? [
          ...asignables,
          {
            value: actividad.responsable_id,
            label: nombres.get(actividad.responsable_id) ?? "—",
          },
        ]
      : asignables;
  const campos = camposActividad(responsables, hoyEnMexico(), sesion.id);
  const titulo = esNueva ? "Registrar actividad" : "Editar actividad";

  return (
    <div className="mx-auto max-w-xl">
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader
        title={titulo}
        description={`${o.nombre} · ${o.cuentas.nombre}`}
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={campos}
            valores={valoresIniciales(campos, actividad)}
            esEdicion={!esNueva}
            guardar={guardarActividad.bind(null, o.id, actividad?.id ?? null)}
            cancelarHref={`/oportunidades/${o.id}`}
            textoGuardar={esNueva ? "Registrar actividad" : "Guardar cambios"}
            eliminar={
              actividad
                ? eliminarActividad.bind(null, o.id, actividad.id)
                : undefined
            }
            confirmarEliminar="¿Eliminar esta actividad?"
          />
        </CardContent>
      </Card>
    </div>
  );
}
