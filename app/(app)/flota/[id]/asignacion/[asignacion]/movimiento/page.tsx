import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { camposMovimiento, nombreEquipo } from "@/lib/flota/campos";
import {
  asignacionesDeRobox,
  carruselDeAsignacion,
  obtenerRobox,
  ubicaciones,
} from "@/lib/flota/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { registrarMovimiento } from "../../../../asignaciones-actions";

export const metadata: Metadata = { title: "Registrar movimiento" };

export default async function MovimientoPage({
  params,
}: PageProps<"/flota/[id]/asignacion/[asignacion]/movimiento">) {
  await requirePermiso("flota.editar");
  const { id, asignacion: asignacionId } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const robox = await obtenerRobox(id);
  if (!robox) notFound();
  const a = (await asignacionesDeRobox(robox.id)).find(
    (x) => x.id === asignacionId,
  );
  if (!a) notFound();
  // Solo se mueve un Robox que sigue asignado.
  if (a.fecha_fin !== null) redirect(`/flota/${robox.id}`);

  const [carrusel, ubicacion] = await Promise.all([
    carruselDeAsignacion(a.id),
    ubicaciones({ roboxIds: [robox.id] }),
  ]);
  const actual = ubicacion.get(robox.id);
  const tanques = carrusel
    .filter((k) => k.equipo_cliente_id !== actual?.tanqueId)
    .map((k) => ({
      value: k.equipo_cliente_id,
      label: k.equipos_cliente ? nombreEquipo(k.equipos_cliente) : "—",
    }));
  const campos = camposMovimiento(tanques, hoyEnMexico());
  const valores = valoresIniciales(campos);
  if (tanques.length === 1 && tanques[0])
    valores.equipo_destino_id = tanques[0].value;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Registrar movimiento"
        description={`Robox ${robox.numero_serie} · ${actual?.tanque ? `ahora en ${actual.tanque}` : "sin tanque definido"}`}
      />
      {tanques.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          No hay otro tanque en el carrusel a dónde moverlo. Agrega primero los
          tanques que atiende este Robox.
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ConfigForm
              campos={campos}
              valores={valores}
              esEdicion={false}
              guardar={registrarMovimiento.bind(null, robox.id, a.id)}
              cancelarHref={`/flota/${robox.id}`}
              textoGuardar="Registrar movimiento"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
