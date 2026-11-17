import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { conceptosDeFactura, obtenerFactura } from "@/lib/facturacion/data";
import { accionesFactura, CAMPOS_CONCEPTO } from "@/lib/facturacion/facturas";
import { valoresIniciales } from "@/lib/forms/campos";
import { FacturaForm } from "../../../factura-form";

export const metadata: Metadata = { title: "Concepto de factura" };

const esId = (v: string) => z.uuid().safeParse(v).success;

export default async function ConceptoPage({
  params,
}: PageProps<"/facturas/[id]/conceptos/[concepto]">) {
  await requirePermiso("facturacion.editar");
  const { id, concepto } = await params;
  if (!esId(id) || !esId(concepto)) notFound();
  const f = await obtenerFactura(id);
  if (!f) notFound();
  if (!accionesFactura(f.estado).editar) redirect(`/facturas/${f.id}`);
  const c = (await conceptosDeFactura(f.id)).find((x) => x.id === concepto);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Concepto de la factura"
        description="La cantidad y el precio vienen del cargo; aquí van la descripción y las claves del SAT."
      />
      <Card>
        <CardContent>
          <FacturaForm
            facturaId={f.id}
            modo={{ tipo: "concepto", conceptoId: c.id }}
            campos={CAMPOS_CONCEPTO}
            valores={valoresIniciales(CAMPOS_CONCEPTO, {
              descripcion: c.descripcion,
              clave_prod_serv: c.clave_prod_serv,
              clave_unidad: c.clave_unidad,
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
