import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { equiposDePlanta } from "@/lib/contratos/data";
import { camposCarrusel, nombreEquipo } from "@/lib/flota/campos";
import {
  asignacionesDeRobox,
  carruselDeAsignacion,
  obtenerRobox,
} from "@/lib/flota/data";
import { valoresIniciales } from "@/lib/forms/campos";
import {
  guardarCarrusel,
  quitarDelCarrusel,
} from "../../../../../asignaciones-actions";

export default async function CarruselPage({
  params,
}: PageProps<"/flota/[id]/asignacion/[asignacion]/carrusel/[registro]">) {
  await requirePermiso("flota.editar");
  const { id, asignacion: asignacionId, registro } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const robox = await obtenerRobox(id);
  if (!robox) notFound();
  const a = (await asignacionesDeRobox(robox.id)).find(
    (x) => x.id === asignacionId,
  );
  if (!a) notFound();

  const esNuevo = registro === "nuevo";
  const [carrusel, equiposPlanta] = await Promise.all([
    carruselDeAsignacion(a.id),
    equiposDePlanta(a.planta_id),
  ]);
  const actual = esNuevo ? undefined : carrusel.find((k) => k.id === registro);
  if (!esNuevo && !actual) notFound();

  // Al agregar solo se ofrecen los equipos que aún no están en el carrusel.
  const enCarrusel = new Set(carrusel.map((k) => k.equipo_cliente_id));
  const equipos = actual
    ? [
        {
          value: actual.equipo_cliente_id,
          label: actual.equipos_cliente
            ? nombreEquipo(actual.equipos_cliente)
            : "—",
        },
      ]
    : equiposPlanta.filter((e) => !enCarrusel.has(e.value));
  const campos = camposCarrusel(equipos);
  const valores = valoresIniciales(
    campos,
    actual && {
      equipo_cliente_id: actual.equipo_cliente_id,
      orden: actual.orden,
      id_caso: actual.id_caso,
    },
  );
  if (esNuevo) valores.orden = String(carrusel.length + 1);
  const titulo = esNuevo ? "Agregar tanque al carrusel" : "Editar tanque";

  return (
    <div className="mx-auto max-w-xl">
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader
        title={titulo}
        description={`Robox ${robox.numero_serie} · ${a.contratos.cuentas.nombre} · ${a.contratos.plantas?.nombre ?? "—"}`}
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={campos}
            valores={valores}
            esEdicion={!esNuevo}
            guardar={guardarCarrusel.bind(
              null,
              robox.id,
              a.id,
              actual?.id ?? null,
            )}
            cancelarHref={`/flota/${robox.id}`}
            textoGuardar={esNuevo ? "Agregar al carrusel" : "Guardar cambios"}
            eliminar={
              actual
                ? quitarDelCarrusel.bind(null, robox.id, a.id, actual.id)
                : undefined
            }
            confirmarEliminar="¿Quitar este tanque del carrusel?"
          />
        </CardContent>
      </Card>
    </div>
  );
}
