import { EvidenciaUploader } from "@/components/evidencia-uploader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TIPOS_EVIDENCIA } from "@/lib/archivos/config";
import type { Evidencia } from "@/lib/ordenes/data";
import { quitarEvidencia } from "@/app/(app)/ordenes/evidencias-actions";

type Props = {
  ordenId: string;
  evidencias: Evidencia[];
  /** Verdadero si quien mira puede agregar y quitar fotos (orden abierta y suya). */
  editable: boolean;
};

const etiqueta = (tipo: string) =>
  TIPOS_EVIDENCIA.find((t) => t.value === tipo)?.label ?? tipo;

/** Fotos de la visita: pantalla del Robox, termómetro, frascos, instalación. */
export function OrdenEvidencias({ ordenId, evidencias, editable }: Props) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-tight">
        Fotos
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {evidencias.length}
        </span>
      </h2>
      {evidencias.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          Aún no hay fotos de esta orden.
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {evidencias.map((e) => (
            <li key={e.id}>
              <Card className="gap-0 overflow-hidden p-0">
                {e.url ? (
                  <a href={e.url} target="_blank" rel="noreferrer">
                    {/* Enlace temporal de Storage: no pasa por el optimizador de imágenes. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.url}
                      alt={`${etiqueta(e.tipo)}: ${e.nombre}`}
                      loading="lazy"
                      className="aspect-square w-full bg-muted object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-muted text-xs text-muted-foreground">
                    No disponible
                  </div>
                )}
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <p className="text-sm">{etiqueta(e.tipo)}</p>
                  {editable ? (
                    <form action={quitarEvidencia.bind(null, ordenId, e.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Quitar
                      </Button>
                    </form>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <div className="mt-3">
          <EvidenciaUploader ordenId={ordenId} />
        </div>
      ) : null}
    </section>
  );
}
