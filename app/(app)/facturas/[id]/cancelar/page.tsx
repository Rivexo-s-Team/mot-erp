import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { obtenerFactura } from "@/lib/facturacion/data";
import {
  accionesFactura,
  CAMPOS_CANCELACION,
  folioFactura,
} from "@/lib/facturacion/facturas";
import { valoresIniciales } from "@/lib/forms/campos";
import { FacturaForm } from "../../factura-form";

export const metadata: Metadata = { title: "Cancelar factura" };

export default async function CancelarFacturaPage({
  params,
}: PageProps<"/facturas/[id]/cancelar">) {
  await requirePermiso("facturacion.editar");
  const { id } = await params;
  const f = z.uuid().safeParse(id).success ? await obtenerFactura(id) : null;
  if (!f) notFound();
  if (!accionesFactura(f.estado).cancelar) redirect(`/facturas/${f.id}`);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={`Cancelar la factura ${folioFactura(f)}`}
        description={f.razones_sociales?.razon_social ?? ""}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Hazlo cuando la factura ya se canceló ante el SAT: el sistema no la
        cancela allá. Aquí queda como cancelada, con sus datos y archivos, y sus
        cargos vuelven a Cargos por facturar para facturarlos de nuevo.
      </p>
      <Card>
        <CardContent>
          <FacturaForm
            facturaId={f.id}
            modo={{ tipo: "cancelacion" }}
            campos={CAMPOS_CANCELACION}
            valores={valoresIniciales(CAMPOS_CANCELACION)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
