import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describirLimite } from "@/lib/catalogos/config";
import {
  gruposDeCaptura,
  type ParametroLab,
} from "@/lib/laboratorio/resultados";

type Props = {
  parametros: ParametroLab[];
  /** {parametro: texto} */
  resultados: Record<string, string>;
};

/** Resultados capturados de una muestra, por grupo, como en el informe. */
export function MuestraResultados({ parametros, resultados }: Props) {
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
        {grupos.map((g) => (
          <section key={g.grupo}>
            <h3 className="mb-1 text-sm font-medium text-muted-foreground">
              {g.titulo}
            </h3>
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th>Parámetro</th>
                  <th>Resultado</th>
                  <th>Límite</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {g.parametros.map((p) => {
                  const limite = describirLimite(p);
                  return (
                    <tr key={p.id}>
                      <td className="py-1.5 pr-3 align-top">{p.nombre}</td>
                      <td className="py-1.5 pr-3 text-right align-top font-medium break-words tabular-nums">
                        {resultados[p.id]}
                        {p.unidad ? (
                          <span className="ml-1 font-normal text-muted-foreground">
                            {p.unidad}
                          </span>
                        ) : null}
                      </td>
                      <td className="hidden w-32 py-1.5 text-right align-top text-muted-foreground sm:table-cell">
                        {limite !== "—" ? limite : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
