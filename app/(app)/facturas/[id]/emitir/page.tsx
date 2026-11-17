import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { obtenerFactura } from "@/lib/facturacion/data";
import { accionesFactura, camposEmision } from "@/lib/facturacion/facturas";
import { valoresIniciales } from "@/lib/forms/campos";
import { formatImporte, hoyEnMexico } from "@/lib/format";
import { FacturaForm } from "../../factura-form";

export const metadata: Metadata = { title: "Registrar factura emitida" };

export default async function EmitirFacturaPage({
  params,
}: PageProps<"/facturas/[id]/emitir">) {
  await requirePermiso("facturacion.editar");
  const { id } = await params;
  const f = z.uuid().safeParse(id).success ? await obtenerFactura(id) : null;
  if (!f) notFound();
  const acciones = accionesFactura(f.estado);
  // Con el XML ya subido el registro quedó comprobado y no se corrige.
  if ((!acciones.emitir && !acciones.corregirRegistro) || f.xml_ruta)
    redirect(`/facturas/${f.id}`);
  const yaEmitida = f.estado === "emitida";
  const hoy = hoyEnMexico();
  const campos = camposEmision(f.moneda, hoy);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={yaEmitida ? "Corregir el registro" : "Registrar factura emitida"}
        description={`${f.razones_sociales?.razon_social ?? ""} · total ${formatImporte(f.factura_totales?.total ?? 0, f.moneda)}`}
      />
      {yaEmitida ? null : (
        <p className="mb-4 text-sm text-muted-foreground">
          Captura los datos de la factura que ya timbraste fuera del sistema. Al
          registrarla queda emitida, ya no se puede cambiar y sus cargos pasan a
          facturados. Después podrás subir su XML y su PDF.
        </p>
      )}
      <Card>
        <CardContent>
          <FacturaForm
            facturaId={f.id}
            modo={{ tipo: "emision", yaEmitida }}
            campos={campos}
            valores={valoresIniciales(campos, {
              serie: f.serie,
              folio: f.folio,
              uuid_fiscal: f.uuid_fiscal,
              // Al registrar se propone hoy; al corregir, la fecha guardada.
              fecha: yaEmitida ? f.fecha : hoy,
              tipo_cambio: f.tipo_cambio,
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
