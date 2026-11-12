import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { listarContratos, nombreContrato } from "@/lib/contratos/data";
import { camposAsignacion } from "@/lib/flota/campos";
import { obtenerRobox, ubicaciones } from "@/lib/flota/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { AsignacionForm } from "../../asignacion-form";

export const metadata: Metadata = { title: "Asignar Robox" };

export default async function AsignarRoboxPage({
  params,
}: PageProps<"/flota/[id]/asignar">) {
  await requirePermiso("flota.editar");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const robox = await obtenerRobox(id);
  if (!robox) notFound();
  // Ya asignado o dado de baja: no hay nada que asignar.
  const ubicacion = await ubicaciones({ roboxIds: [robox.id] });
  if (ubicacion.has(robox.id) || robox.estado === "baja")
    redirect(`/flota/${robox.id}`);

  const contratos = (await listarContratos({}))
    .filter((c) => c.estado === "borrador" || c.estado === "vigente")
    .map((c) => ({
      value: c.id,
      label: `${c.cuentas.nombre} · ${nombreContrato(c)}${c.referencia ? ` · ${c.referencia}` : ""}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const campos = camposAsignacion(contratos, hoyEnMexico(), false);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Asignar a un contrato"
        description={`Robox ${robox.numero_serie}`}
      />
      <Card>
        <CardContent>
          <AsignacionForm
            roboxId={robox.id}
            asignacionId={null}
            campos={campos}
            valores={valoresIniciales(campos)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
