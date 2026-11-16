import { EstadoDocumentoBadge } from "@/components/estado-documento-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { impideEntrada, type RenglonAcceso } from "@/lib/acceso/documentos";
import { formatDia } from "@/lib/format";

type Props = {
  /** Lo que pide la planta para entrar. */
  requisitos: { id: string; nombre: string; detalle: string | null }[];
  /** Documentos de MOT y de quienes van a la visita. */
  documentos: RenglonAcceso[];
};

/** Lo que hay que revisar antes de ir a la planta. */
export function AccesoPlanta({ requisitos, documentos }: Props) {
  const problemas = documentos.filter(impideEntrada).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acceso a planta</CardTitle>
        <p
          className={`text-sm ${problemas > 0 ? "font-medium text-destructive" : "text-muted-foreground"}`}
        >
          {problemas > 0
            ? `Antes de ir: ${problemas === 1 ? "hay 1 documento vencido o faltante" : `hay ${problemas} documentos vencidos o faltantes`}.`
            : "Revisa esto antes de ir."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="mb-1 text-muted-foreground">Lo que pide la planta</p>
          {requisitos.length === 0 ? (
            <p>No hay requisitos de acceso registrados para esta planta.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              {requisitos.map((r) => (
                <li key={r.id}>
                  {r.nombre}
                  {r.detalle ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {r.detalle}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-1 text-muted-foreground">Documentos</p>
          {documentos.length === 0 ? (
            <p>No hay tipos de documento definidos.</p>
          ) : (
            <ul className="space-y-1.5">
              {documentos.map((d) => (
                <li
                  key={d.clave}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                >
                  <span>
                    {d.documentoId && d.tieneArchivo ? (
                      <a
                        href={`/archivos/documento-acceso/${d.documentoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {d.documento}
                      </a>
                    ) : (
                      d.documento
                    )}
                    <span className="text-muted-foreground">
                      {" "}
                      · {d.de}
                      {d.vencimiento
                        ? ` · vence el ${formatDia(d.vencimiento)}`
                        : ""}
                    </span>
                  </span>
                  <EstadoDocumentoBadge estado={d.estado} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
