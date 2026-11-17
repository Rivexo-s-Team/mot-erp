import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { obtenerFactura } from "@/lib/facturacion/data";
import { accionesFactura, camposFactura } from "@/lib/facturacion/facturas";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { FacturaForm } from "../../factura-form";

export const metadata: Metadata = { title: "Editar factura" };

export default async function EditarFacturaPage({
  params,
}: PageProps<"/facturas/[id]/editar">) {
  await requirePermiso("facturacion.editar");
  const { id } = await params;
  const f = z.uuid().safeParse(id).success ? await obtenerFactura(id) : null;
  if (!f) notFound();
  if (!accionesFactura(f.estado).editar) redirect(`/facturas/${f.id}`);
  const campos = camposFactura(f.moneda, hoyEnMexico());

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Editar factura en borrador"
        description={f.razones_sociales?.razon_social ?? ""}
      />
      <Card>
        <CardContent>
          <FacturaForm
            facturaId={f.id}
            modo={{ tipo: "encabezado" }}
            campos={campos}
            valores={valoresIniciales(campos, {
              fecha: f.fecha,
              tipo_cambio: f.tipo_cambio,
              metodo_pago: f.metodo_pago,
              forma_pago: f.forma_pago,
              uso_cfdi: f.uso_cfdi,
              dias_credito: f.dias_credito,
              orden_compra: f.orden_compra,
              notas: f.notas,
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
