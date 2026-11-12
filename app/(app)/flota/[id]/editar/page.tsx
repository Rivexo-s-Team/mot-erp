import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { CAMPOS_ROBOX } from "@/lib/flota/campos";
import { obtenerRobox } from "@/lib/flota/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { eliminarRobox, guardarRobox } from "../../actions";

export const metadata: Metadata = { title: "Editar Robox" };

export default async function EditarRoboxPage({
  params,
}: PageProps<"/flota/[id]/editar">) {
  await requirePermiso("flota.editar");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const robox = await obtenerRobox(id);
  if (!robox) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Editar Robox"
        description={`Número de serie ${robox.numero_serie}`}
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={CAMPOS_ROBOX}
            valores={valoresIniciales(CAMPOS_ROBOX, {
              numero_serie: robox.numero_serie,
              modelo: robox.modelo,
              version_programa: robox.version_programa,
              sim: robox.sim,
              estado: robox.estado,
              fecha_alta: robox.fecha_alta,
              notas: robox.notas,
            })}
            esEdicion
            guardar={guardarRobox.bind(null, robox.id)}
            cancelarHref={`/flota/${robox.id}`}
            textoGuardar="Guardar cambios"
            eliminar={eliminarRobox.bind(null, robox.id)}
            confirmarEliminar={`¿Eliminar el Robox ${robox.numero_serie} de la lista? Si solo salió de servicio, mejor cámbiale el estado a Baja.`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
