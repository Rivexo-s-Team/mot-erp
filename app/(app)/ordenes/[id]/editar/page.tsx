import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { nombreEquipo } from "@/lib/flota/campos";
import { valoresIniciales, type Opcion } from "@/lib/forms/campos";
import { accionesOrden, camposOrden } from "@/lib/ordenes/campos";
import {
  directorioTecnicos,
  lugarOrden,
  obtenerOrden,
  opcionesOrden,
} from "@/lib/ordenes/data";
import { OrdenForm } from "../../orden-form";

export const metadata: Metadata = { title: "Editar orden de servicio" };

/** Conserva en la lista el valor guardado aunque ya no esté entre las opciones. */
function conservar(opciones: Opcion[], value: string | null, label: string) {
  if (value && !opciones.some((o) => o.value === value))
    opciones.push({ value, label });
}

export default async function EditarOrdenPage({
  params,
}: PageProps<"/ordenes/[id]/editar">) {
  const sesion = await requirePermiso("ordenes.editar");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const o = await obtenerOrden(id);
  if (!o) notFound();
  if (!accionesOrden(o.estado).editar) redirect(`/ordenes/${o.id}`);

  const [opciones, { nombres }] = await Promise.all([
    opcionesOrden(o.cuenta_id),
    directorioTecnicos(),
  ]);
  conservar(opciones.plantas, o.planta_id, o.plantas?.nombre ?? "—");
  conservar(opciones.contratos, o.contrato_id, "Contrato actual");
  conservar(
    opciones.equipos,
    o.equipo_cliente_id,
    o.equipos_cliente ? nombreEquipo(o.equipos_cliente) : "—",
  );
  conservar(opciones.robox, o.robox_id, o.robox?.numero_serie ?? "—");
  conservar(opciones.tecnicos, o.tecnico_id, nombres.get(o.tecnico_id) ?? "—");
  conservar(
    opciones.tecnicos,
    o.acompanante_id,
    o.acompanante_id ? (nombres.get(o.acompanante_id) ?? "—") : "—",
  );

  const campos = camposOrden(
    o.cuenta_id ? "visita" : "taller",
    opciones,
    "",
    tienePermiso(sesion, "ordenes.administrar"),
  );

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={`Editar orden ${o.folio}`}
        description={lugarOrden(o)}
      />
      <Card>
        <CardContent>
          <OrdenForm
            cuentaId={o.cuenta_id}
            ordenId={o.id}
            campos={campos}
            valores={valoresIniciales(campos, {
              planta_id: o.planta_id,
              contrato_id: o.contrato_id,
              equipo_cliente_id: o.equipo_cliente_id,
              robox_id: o.robox_id,
              tecnico_id: o.tecnico_id,
              acompanante_id: o.acompanante_id,
              fecha_programada: o.fecha_programada,
              notas: o.notas,
            })}
            cancelarHref={`/ordenes/${o.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
