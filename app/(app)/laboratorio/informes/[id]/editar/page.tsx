import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { muestrasDeEquipo, obtenerInforme } from "@/lib/laboratorio/data";
import { accionesInforme } from "@/lib/laboratorio/informe";
import {
  camposInformeEdicion,
  casillaDeMuestra,
} from "@/lib/laboratorio/informe-campos";
import { InformeForm } from "../../informe-form";

export const metadata: Metadata = { title: "Editar informe" };

export default async function EditarInformePage({
  params,
}: PageProps<"/laboratorio/informes/[id]/editar">) {
  await requirePermiso("laboratorio.editar");
  const { id } = await params;
  const informe = z.uuid().safeParse(id).success
    ? await obtenerInforme(id)
    : null;
  if (!informe) notFound();
  if (!accionesInforme(informe.estado).editar)
    redirect(`/laboratorio/informes/${informe.id}`);

  const delEquipo = await muestrasDeEquipo(informe.equipo_cliente_id);
  const campos = camposInformeEdicion(delEquipo, hoyEnMexico());
  const incluidas = new Set(informe.informe_muestras.map((m) => m.muestra_id));

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={`Editar informe ${informe.folio}`}
        description={informe.cuentas?.nombre ?? ""}
      />
      <Card>
        <CardContent>
          <InformeForm
            modo={{ informeId: informe.id }}
            campos={campos}
            valores={valoresIniciales(campos, {
              folio: informe.folio,
              fecha_emision: informe.fecha_emision,
              observaciones: informe.observaciones,
              ...Object.fromEntries(
                delEquipo.map((m) => [
                  casillaDeMuestra(m.id),
                  incluidas.has(m.id),
                ]),
              ),
            })}
            cancelarHref={`/laboratorio/informes/${informe.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
