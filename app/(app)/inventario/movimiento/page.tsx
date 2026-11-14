import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { camposMovimiento } from "@/lib/inventario/campos";
import { partesParaElegir } from "@/lib/inventario/data";
import { MovimientoForm } from "../movimiento-form";

export const metadata: Metadata = { title: "Registrar movimiento" };

export default async function MovimientoPage({
  searchParams,
}: PageProps<"/inventario/movimiento">) {
  await requirePermiso("inventario.editar");
  const { parte } = await searchParams;
  const partes = await partesParaElegir();
  const campos = camposMovimiento(partes, hoyEnMexico());
  const valores = valoresIniciales(campos);
  const elegida = partes.find((p) => p.value === parte);
  if (elegida) valores.parte_id = elegida.value;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Registrar movimiento"
        description="Entrada, salida o ajuste por conteo de una parte."
      />
      <Card>
        <CardContent>
          <MovimientoForm
            campos={campos}
            valores={valores}
            cancelarHref={
              elegida ? `/inventario/${elegida.value}` : "/inventario"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
