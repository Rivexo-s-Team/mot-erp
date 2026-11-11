import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { camposOportunidad } from "@/lib/pipeline/campos";
import {
  directorioComercial,
  listarCanalesActivos,
  obtenerOportunidad,
  plantasDeCuenta,
} from "@/lib/pipeline/data";
import { eliminarOportunidad, guardarOportunidad } from "../../actions";

export const metadata: Metadata = { title: "Editar oportunidad" };

export default async function EditarOportunidadPage({
  params,
}: PageProps<"/oportunidades/[id]/editar">) {
  await requirePermiso("oportunidades.editar");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const o = await obtenerOportunidad(id);
  if (!o) notFound();

  const [plantas, { asignables, nombres }, canales] = await Promise.all([
    plantasDeCuenta(o.cuenta_id),
    directorioComercial(),
    listarCanalesActivos(),
  ]);
  // Si el responsable actual ya no es asignable (se desactivó), se conserva en la lista.
  const responsables = asignables.some((r) => r.value === o.responsable_id)
    ? asignables
    : [
        ...asignables,
        {
          value: o.responsable_id,
          label: nombres.get(o.responsable_id) ?? "—",
        },
      ];
  const canalesConActual =
    o.canal_venta_id &&
    o.canales_venta &&
    !canales.some((c) => c.value === o.canal_venta_id)
      ? [...canales, { value: o.canal_venta_id, label: o.canales_venta.nombre }]
      : canales;
  const campos = camposOportunidad(plantas, responsables, canalesConActual);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Editar oportunidad"
        description={`${o.nombre} · ${o.cuentas.nombre}`}
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={campos}
            valores={valoresIniciales(campos, {
              nombre: o.nombre,
              planta_id: o.planta_id,
              tipo: o.tipo,
              origen: o.origen,
              responsable_id: o.responsable_id,
              canal_venta_id: o.canal_venta_id,
              volumen_estimado_l: o.volumen_estimado_l,
              notas: o.notas,
            })}
            esEdicion
            guardar={guardarOportunidad.bind(null, o.cuenta_id, o.id)}
            cancelarHref={`/oportunidades/${o.id}`}
            textoGuardar="Guardar cambios"
            eliminar={eliminarOportunidad.bind(null, o.id)}
            confirmarEliminar={`¿Eliminar la oportunidad "${o.nombre}"?`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
