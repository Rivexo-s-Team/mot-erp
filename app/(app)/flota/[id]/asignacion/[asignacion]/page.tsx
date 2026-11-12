import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { etiqueta, TIPOS_CONTRATO } from "@/lib/contratos/campos";
import { camposAsignacion } from "@/lib/flota/campos";
import { asignacionesDeRobox, obtenerRobox } from "@/lib/flota/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { AsignacionForm } from "../../../asignacion-form";

export const metadata: Metadata = { title: "Editar asignación" };

export default async function AsignacionPage({
  params,
}: PageProps<"/flota/[id]/asignacion/[asignacion]">) {
  await requirePermiso("flota.editar");
  const { id, asignacion: asignacionId } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const robox = await obtenerRobox(id);
  if (!robox) notFound();
  const a = (await asignacionesDeRobox(robox.id)).find(
    (x) => x.id === asignacionId,
  );
  if (!a) notFound();

  const contrato = `${a.contratos.cuentas.nombre} · ${etiqueta(TIPOS_CONTRATO, a.contratos.tipo)} · ${a.contratos.plantas?.nombre ?? "—"}`;
  const campos = camposAsignacion(
    [{ value: a.contrato_id, label: contrato }],
    "",
    true,
  );

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Editar asignación"
        description={`Robox ${robox.numero_serie} · ${contrato}`}
      />
      <Card>
        <CardContent>
          <AsignacionForm
            roboxId={robox.id}
            asignacionId={a.id}
            campos={campos}
            valores={valoresIniciales(campos, {
              contrato_id: a.contrato_id,
              fecha_inicio: a.fecha_inicio,
              fecha_fin: a.fecha_fin,
              notas: a.notas,
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
