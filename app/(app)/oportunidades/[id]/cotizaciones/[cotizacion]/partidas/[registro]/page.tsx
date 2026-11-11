import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { camposPartida } from "@/lib/cotizaciones/campos";
import {
  equiposParaCotizar,
  parametrosCotizador,
} from "@/lib/cotizaciones/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { cargarCotizacion } from "../../contexto";
import { PartidaForm } from "../../partida-form";

export default async function PartidaPage({
  params,
}: PageProps<"/oportunidades/[id]/cotizaciones/[cotizacion]/partidas/[registro]">) {
  const { id, cotizacion: cotizacionId, registro } = await params;
  const { oportunidad, cotizacion, editable } = await cargarCotizacion(
    id,
    cotizacionId,
  );
  if (!editable) redirect(`/oportunidades/${id}/cotizaciones/${cotizacionId}`);

  const esNueva = registro === "nueva";
  const linea = esNueva
    ? undefined
    : cotizacion.lineas.find((l) => l.id === registro);
  if (!esNueva && !linea) notFound();

  const [equipos, parametros] = await Promise.all([
    equiposParaCotizar(oportunidad.cuenta_id, oportunidad.planta_id),
    parametrosCotizador(),
  ]);
  const campos = camposPartida(equipos);
  const valores = valoresIniciales(
    campos,
    linea && {
      concepto: linea.concepto,
      equipo_cliente_id: linea.equipo_cliente_id,
      unidad: linea.unidad,
      cantidad: linea.cantidad,
      recurrente: linea.recurrente,
      precio_referencia: linea.precio_referencia,
      fuente_tipo: linea.fuente_tipo,
      fuente_url: linea.fuente_url,
      fecha_referencia: linea.fecha_referencia,
      precio_unitario: linea.precio_unitario,
      orden: linea.orden,
    },
  );
  // Una partida nueva va al final.
  if (esNueva) valores.orden = String((cotizacion.lineas.length + 1) * 10);
  const titulo = esNueva ? "Nueva partida" : "Editar partida";

  return (
    <div className="mx-auto max-w-xl">
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader
        title={titulo}
        description={`Cotización versión ${cotizacion.version} (${cotizacion.moneda}) · ${oportunidad.nombre}`}
      />
      <Card>
        <CardContent>
          <PartidaForm
            oportunidadId={id}
            cotizacionId={cotizacionId}
            id={linea?.id ?? null}
            campos={campos}
            valores={valores}
            moneda={cotizacion.moneda}
            tipoCambio={cotizacion.tipo_cambio}
            parametros={parametros}
          />
        </CardContent>
      </Card>
    </div>
  );
}
