import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { obtenerMuestra, opcionesMuestra } from "@/lib/laboratorio/data";
import { camposMuestra } from "@/lib/laboratorio/muestras";
import { MuestraForm } from "../../muestra-form";

export const metadata: Metadata = { title: "Editar muestra" };

export default async function EditarMuestraPage({
  params,
}: PageProps<"/laboratorio/muestras/[id]/editar">) {
  await requirePermiso("laboratorio.editar");
  const { id } = await params;
  const m = z.uuid().safeParse(id).success ? await obtenerMuestra(id) : null;
  if (!m) notFound();

  const opciones = await opcionesMuestra(m.cuenta_id);
  const campos = camposMuestra(true, opciones, hoyEnMexico());

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={`Editar muestra ${m.id_muestra}`}
        description={m.cuentas?.nombre ?? ""}
      />
      <Card>
        <CardContent>
          <MuestraForm
            cuentaId={m.cuenta_id}
            muestraId={m.id}
            campos={campos}
            valores={valoresIniciales(campos, {
              equipo_cliente_id: m.equipo_cliente_id,
              tipo: m.tipo,
              tomada_por: m.tomada_por,
              fecha_muestreo: m.fecha_muestreo,
              fecha_recepcion: m.fecha_recepcion,
              id_muestra: m.id_muestra,
              nivel_analisis: m.nivel_analisis,
              id_caso: m.id_caso,
              punto_muestreo: m.punto_muestreo,
              condicion_operacion: m.condicion_operacion,
              orden_id: m.orden_id,
              oportunidad_id: m.oportunidad_id,
              estado: m.estado,
              notas: m.notas,
            })}
            cancelarHref={`/laboratorio/muestras/${m.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
