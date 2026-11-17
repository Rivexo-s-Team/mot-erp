import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { obtenerPago } from "@/lib/facturacion/data";
import { CAMPOS_COMPLEMENTO } from "@/lib/facturacion/pagos";
import { valoresIniciales } from "@/lib/forms/campos";
import { formatDia, formatImporte } from "@/lib/format";
import { ComplementoForm } from "../../complemento-form";

export const metadata: Metadata = { title: "Complemento de pago" };

export default async function ComplementoPage({
  params,
}: PageProps<"/pagos/[id]/complemento">) {
  await requirePermiso("facturacion.editar");
  const { id } = await params;
  const p = z.uuid().safeParse(id).success ? await obtenerPago(id) : null;
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Complemento de pago"
        description={`${p.razones_sociales?.razon_social ?? ""} · ${formatImporte(p.monto, p.moneda)} · ${formatDia(p.fecha)}`}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Por ahora el complemento (REP) se timbra fuera del sistema. Captura aquí
        su folio y su folio fiscal para dejar constancia.
      </p>
      <Card>
        <CardContent>
          <ComplementoForm
            pagoId={p.id}
            valores={valoresIniciales(CAMPOS_COMPLEMENTO, {
              rep_folio: p.rep_folio,
              rep_uuid: p.rep_uuid,
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
