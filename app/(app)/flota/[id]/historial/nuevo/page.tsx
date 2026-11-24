import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { camposHistorial } from "@/lib/flota/campos";
import { obtenerRobox } from "@/lib/flota/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { HistorialForm } from "../../../historial-form";

export default async function NuevoMovimientoDeAlmacenPage({
  params,
}: PageProps<"/flota/[id]/historial/nuevo">) {
  await requirePermiso("flota.editar");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const robox = await obtenerRobox(id);
  if (!robox) notFound();
  const campos = camposHistorial(hoyEnMexico());

  return (
    <div className="mx-auto max-w-xl">
      <title>Registrar movimiento de almacén · Sistema MOT</title>
      <PageHeader
        migas={[
          { label: "Flota", href: "/flota" },
          { label: `Robox ${robox.numero_serie}`, href: `/flota/${robox.id}` },
        ]}
        title="Registrar movimiento de almacén"
        description="Salidas, entradas, limpiezas y reparaciones. Queda en el historial y ya no se modifica."
      />
      <Card>
        <CardContent>
          <HistorialForm
            roboxId={robox.id}
            campos={campos}
            valores={valoresIniciales(campos)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
