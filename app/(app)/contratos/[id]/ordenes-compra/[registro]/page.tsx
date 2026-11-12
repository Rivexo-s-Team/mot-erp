import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { camposOrdenCompra } from "@/lib/contratos/campos";
import {
  nombreContrato,
  obtenerContrato,
  ordenesDeContrato,
} from "@/lib/contratos/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { OrdenCompraForm } from "../../../orden-compra-form";

export default async function OrdenCompraPage({
  params,
}: PageProps<"/contratos/[id]/ordenes-compra/[registro]">) {
  const sesion = await requirePermiso("contratos.editar");
  const { id, registro } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // Las órdenes de compra llevan importes.
  if (!tienePermiso(sesion, "precios.ver")) redirect(`/contratos/${id}`);
  const c = await obtenerContrato(id);
  if (!c) notFound();

  const esNueva = registro === "nueva";
  const orden = esNueva
    ? undefined
    : (await ordenesDeContrato(c.id)).find((o) => o.id === registro);
  if (!esNueva && !orden) notFound();

  const campos = camposOrdenCompra(c.moneda);
  const titulo = esNueva ? "Agregar orden de compra" : "Editar orden de compra";

  return (
    <div className="mx-auto max-w-xl">
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader
        title={titulo}
        description={`${c.cuentas.nombre} · ${nombreContrato(c)}`}
      />
      <Card>
        <CardContent>
          <OrdenCompraForm
            contratoId={c.id}
            ordenId={orden?.id ?? null}
            campos={campos}
            valores={valoresIniciales(
              campos,
              orden && {
                numero: orden.numero,
                monto: orden.monto,
                fecha_inicio: orden.fecha_inicio,
                fecha_termino: orden.fecha_termino,
                notas: orden.notas,
              },
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
