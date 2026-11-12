import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { camposCotizacion } from "@/lib/cotizaciones/campos";
import { contactosDeCuenta } from "@/lib/cotizaciones/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { cargarCotizacion } from "../contexto";
import { CotizacionForm } from "../cotizacion-form";

export const metadata: Metadata = { title: "Datos de la cotización" };

export default async function EditarCotizacionPage({
  params,
}: PageProps<"/oportunidades/[id]/cotizaciones/[cotizacion]/editar">) {
  const { id, cotizacion: cotizacionId } = await params;
  const { oportunidad, cotizacion, editable } = await cargarCotizacion(
    id,
    cotizacionId,
  );
  if (!editable) redirect(`/oportunidades/${id}/cotizaciones/${cotizacionId}`);

  const campos = camposCotizacion(
    await contactosDeCuenta(oportunidad.cuenta_id),
  );

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Datos de la cotización"
        description={`${cotizacion.folio} · versión ${cotizacion.version} · ${oportunidad.nombre}`}
      />
      <Card>
        <CardContent>
          <CotizacionForm
            oportunidadId={id}
            cotizacionId={cotizacionId}
            campos={campos}
            valores={valoresIniciales(campos, {
              contacto_id: cotizacion.contacto_id,
              numero_requisicion: cotizacion.numero_requisicion,
              condiciones_pago: cotizacion.condiciones_pago,
              moneda: cotizacion.moneda,
              tipo_cambio: cotizacion.tipo_cambio,
              vigencia: cotizacion.vigencia,
              valor_total_contrato: cotizacion.valor_total_contrato,
              litros_estimados: cotizacion.litros_estimados,
              condiciones: cotizacion.condiciones,
              notas: cotizacion.notas,
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
