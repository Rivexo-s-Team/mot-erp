import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { camposCredito } from "@/lib/facturacion/credito";
import {
  creditoDeCuenta,
  razonSocialParaCredito,
} from "@/lib/facturacion/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { CreditoForm } from "./credito-form";

export const metadata: Metadata = { title: "Condiciones de crédito" };

const esId = (v: string) => z.uuid().safeParse(v).success;

export default async function CreditoPage({
  params,
}: PageProps<"/clientes/[id]/razones-sociales/[registro]/credito">) {
  await requirePermiso("facturacion.editar");
  const { id, registro } = await params;
  if (!esId(id) || !esId(registro)) notFound();
  const [razon, credito] = await Promise.all([
    razonSocialParaCredito(id, registro),
    creditoDeCuenta(id),
  ]);
  if (!razon) notFound();
  const actual = credito.get(razon.id);
  const campos = camposCredito(razon.contactos);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Condiciones de crédito"
        description={`${razon.razon_social} · ${razon.rfc}`}
      />
      <Card>
        <CardContent>
          <CreditoForm
            cuentaId={id}
            razonId={razon.id}
            campos={campos}
            existen={Boolean(actual)}
            valores={
              actual
                ? valoresIniciales(campos, {
                    dias_credito: actual.dias_credito,
                    requiere_orden_compra: actual.requiere_orden_compra,
                    metodo_pago: actual.metodo_pago,
                    forma_pago: actual.forma_pago,
                    contacto_cxp_id: actual.contacto_cxp_id,
                    portal: actual.portal,
                    notas: actual.notas,
                  })
                : valoresIniciales(campos)
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
