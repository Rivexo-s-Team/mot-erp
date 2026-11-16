import { CondicionBadge } from "@/components/condicion-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describirLimite } from "@/lib/catalogos/config";
import type { EvaluacionMuestra } from "@/lib/laboratorio/evaluacion";
import {
  gruposDeCaptura,
  type ParametroLab,
} from "@/lib/laboratorio/resultados";

type Props = {
  parametros: ParametroLab[];
  /** {parametro: texto} */
  resultados: Record<string, string>;
  evaluacion: EvaluacionMuestra;
  esVirgen: boolean;
};

/** Resultados de una muestra por grupo, como en el informe, con su evaluación. */
export function MuestraResultados({
  parametros,
  resultados,
  evaluacion,
  esVirgen,
}: Props) {
  const conResultado = new Set(Object.keys(resultados));
  const grupos = gruposDeCaptura(
    parametros.filter((p) => conResultado.has(p.id)),
    conResultado,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Resultados
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {conResultado.size}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <CondicionBadge
            titulo="Condición del aceite"
            resumen={evaluacion.aceite}
          />
          {esVirgen ? null : (
            <CondicionBadge
              titulo="Condición de aditivos"
              resumen={evaluacion.aditivos}
            />
          )}
        </div>
        {grupos.map((g) => (
          <section key={g.grupo}>
            <h3 className="mb-1 text-sm font-medium text-muted-foreground">
              {g.titulo}
            </h3>
            <ul className="divide-y text-sm">
              {g.parametros.map((p) => {
                const e = evaluacion.porParametro[p.id];
                const limite = describirLimite(p);
                // El límite que se aplicó a esta muestra, o el del catálogo.
                const detalle =
                  e?.detalle ?? (limite !== "—" ? `Límite ${limite}` : null);
                return (
                  <li
                    key={p.id}
                    className="grid grid-cols-[1fr_auto] items-start gap-x-3 py-1.5 sm:grid-cols-[1fr_auto_5.5rem]"
                  >
                    <div className="min-w-0">
                      <p>
                        {p.nombre}
                        {p.cuenta_para ? null : e?.veredicto === "no_pasa" ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · no cuenta para la condición
                          </span>
                        ) : null}
                      </p>
                      {detalle ? (
                        <p className="text-muted-foreground">{detalle}</p>
                      ) : null}
                    </div>
                    <p className="text-right font-medium break-words tabular-nums">
                      {resultados[p.id]}
                      {p.unidad ? (
                        <span className="ml-1 font-normal text-muted-foreground">
                          {p.unidad}
                        </span>
                      ) : null}
                    </p>
                    <p className="col-span-2 sm:col-span-1 sm:text-right">
                      {e?.veredicto === "pasa" ? (
                        <Badge variant="outline">Pasa</Badge>
                      ) : e?.veredicto === "no_pasa" ? (
                        <Badge variant="destructive">No pasa</Badge>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
