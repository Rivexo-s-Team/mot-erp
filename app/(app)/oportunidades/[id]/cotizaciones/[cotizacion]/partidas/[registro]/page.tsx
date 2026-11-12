import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { FileUploader } from "@/components/forms/file-uploader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { camposPartida } from "@/lib/cotizaciones/campos";
import {
  equiposParaCotizar,
  parametrosCotizador,
} from "@/lib/cotizaciones/data";
import { valoresIniciales } from "@/lib/forms/campos";
import {
  prepararComprobante,
  quitarComprobante,
  registrarComprobante,
} from "../../../../../archivos-actions";
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
      numero_parte_cliente: linea.numero_parte_cliente,
      referencia_costo_contenedor: linea.referencia_costo_contenedor,
      referencia_litros_contenedor: linea.referencia_litros_contenedor,
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
        description={`${cotizacion.folio} · versión ${cotizacion.version} (${cotizacion.moneda}) · ${oportunidad.nombre}`}
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

      {linea ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Comprobante del precio del aceite nuevo</CardTitle>
            <CardDescription>
              La factura o cotización del cliente, o la captura de internet, de
              donde salió el precio de referencia.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {linea.fuente_archivo_ruta ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <a
                  href={`/archivos/comprobante/${linea.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium break-words text-primary underline-offset-4 hover:underline"
                >
                  {linea.fuente_archivo_nombre}
                </a>
                <form
                  action={quitarComprobante.bind(
                    null,
                    id,
                    cotizacionId,
                    linea.id,
                  )}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    Quitar
                  </Button>
                </form>
              </div>
            ) : null}
            <FileUploader
              texto={
                linea.fuente_archivo_ruta
                  ? "Reemplazar comprobante"
                  : "Subir comprobante"
              }
              preparar={prepararComprobante.bind(
                null,
                id,
                cotizacionId,
                linea.id,
              )}
              registrar={registrarComprobante.bind(
                null,
                id,
                cotizacionId,
                linea.id,
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Para adjuntar el comprobante del precio del aceite nuevo, primero
          guarda la partida y vuelve a abrirla.
        </p>
      )}
    </div>
  );
}
