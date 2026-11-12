import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { camposTarifa } from "@/lib/contratos/campos";
import {
  equiposDePlanta,
  nombreContrato,
  obtenerContrato,
  tarifasDeContrato,
} from "@/lib/contratos/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { eliminarTarifa, guardarTarifa } from "../../../actions";

export default async function TarifaPage({
  params,
}: PageProps<"/contratos/[id]/tarifas/[registro]">) {
  const sesion = await requirePermiso("contratos.editar");
  const { id, registro } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // Las tarifas son precios.
  if (!tienePermiso(sesion, "precios.ver")) redirect(`/contratos/${id}`);
  const c = await obtenerContrato(id);
  if (!c) notFound();

  const esNueva = registro === "nueva";
  const [tarifas, equipos] = await Promise.all([
    tarifasDeContrato(c.id),
    equiposDePlanta(c.planta_id),
  ]);
  const tarifa = esNueva ? undefined : tarifas.find((t) => t.id === registro);
  if (!esNueva && !tarifa) notFound();
  // Un equipo dado de baja se conserva en la lista de la tarifa que ya lo tenía.
  if (
    tarifa?.equipo_cliente_id &&
    !equipos.some((e) => e.value === tarifa.equipo_cliente_id)
  ) {
    equipos.push({
      value: tarifa.equipo_cliente_id,
      label: tarifa.equipos_cliente?.identificador ?? "—",
    });
  }

  const campos = camposTarifa(equipos, c.moneda);
  const valores = valoresIniciales(
    campos,
    tarifa && {
      concepto: tarifa.concepto,
      unidad: tarifa.unidad,
      precio: tarifa.precio,
      equipo_cliente_id: tarifa.equipo_cliente_id,
      orden: tarifa.orden,
      notas: tarifa.notas,
    },
  );
  if (esNueva) valores.orden = String(tarifas.length + 1);
  const titulo = esNueva ? "Agregar tarifa" : "Editar tarifa";

  return (
    <div className="mx-auto max-w-xl">
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader
        title={titulo}
        description={`${c.cuentas.nombre} · ${nombreContrato(c)}`}
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={campos}
            valores={valores}
            esEdicion={!esNueva}
            guardar={guardarTarifa.bind(null, c.id, tarifa?.id ?? null)}
            cancelarHref={`/contratos/${c.id}`}
            textoGuardar={esNueva ? "Agregar tarifa" : "Guardar cambios"}
            eliminar={
              tarifa ? eliminarTarifa.bind(null, c.id, tarifa.id) : undefined
            }
            confirmarEliminar="¿Eliminar esta tarifa?"
          />
        </CardContent>
      </Card>
    </div>
  );
}
