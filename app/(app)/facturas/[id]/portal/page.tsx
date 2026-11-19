import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { CAMPOS_PORTAL } from "@/lib/facturacion/cobranza";
import {
  obtenerFactura,
  portalDeFacturas,
  portalDeRazon,
} from "@/lib/facturacion/data";
import { folioFactura } from "@/lib/facturacion/facturas";
import { valoresIniciales } from "@/lib/forms/campos";
import { PortalForm } from "../../portal-form";

export const metadata: Metadata = { title: "Portal de proveedores" };

export default async function PortalPage({
  params,
}: PageProps<"/facturas/[id]/portal">) {
  await requirePermiso("facturacion.editar");
  const { id } = await params;
  const f = z.uuid().safeParse(id).success ? await obtenerFactura(id) : null;
  if (!f || f.estado !== "emitida") notFound();
  const [seguimientos, { portal }] = await Promise.all([
    portalDeFacturas([f.id]),
    portalDeRazon(f.razon_social_id),
  ]);
  const actual = seguimientos.get(f.id);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Portal de proveedores"
        description={`Factura ${folioFactura(f)} · ${f.razones_sociales?.razon_social ?? ""}`}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Anota cómo va la factura en el portal del cliente
        {portal ? ` (${portal})` : ""}. El sistema no se conecta al portal: es
        un registro de seguimiento.
      </p>
      <Card>
        <CardContent>
          <PortalForm
            facturaId={f.id}
            valores={valoresIniciales(
              CAMPOS_PORTAL,
              actual
                ? {
                    estado: actual.estado,
                    fecha_subida: actual.fecha_subida,
                    fecha_aprobacion: actual.fecha_aprobacion,
                    fecha_pago_programado: actual.fecha_pago_programado,
                    notas: actual.notas,
                  }
                : undefined,
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
