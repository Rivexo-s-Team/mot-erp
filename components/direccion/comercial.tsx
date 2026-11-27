import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResumenComercial } from "@/lib/direccion/comercial";
import { Cifra } from "./cifra";

const enteros = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const n = (c: number, uno: string, varios: string) =>
  `${c} ${c === 1 ? uno : varios}`;

/** Parte comercial del tablero: qué hay abierto y cómo cerró lo decidido en el periodo. */
export function Comercial({
  r,
  meses,
}: {
  r: ResumenComercial;
  meses: number;
}) {
  const maximo = Math.max(1, ...r.porEtapa.map((e) => e.cantidad));
  return (
    <section aria-label="Comercial">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">Comercial</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cifra
          titulo="Oportunidades abiertas"
          valor={String(r.abiertas)}
          nota={
            r.porTipo
              .filter((t) => t.cantidad > 0)
              .map((t) => `${t.cantidad} ${t.label.toLowerCase()}`)
              .join(" · ") || "Ninguna en curso"
          }
          href="/oportunidades"
        />
        <Cifra
          titulo="Seguimientos vencidos"
          valor={String(r.seguimientosVencidos)}
          nota={
            r.sinSiguientePaso > 0 ? (
              <span className="text-destructive">
                {n(r.sinSiguientePaso, "abierta", "abiertas")} sin siguiente
                paso
              </span>
            ) : (
              "Todas las abiertas tienen siguiente paso"
            )
          }
          href="/oportunidades"
        />
        <Cifra
          titulo={`Tasa de cierre · ${meses} meses`}
          valor={r.tasaDeCierre === null ? "—" : `${r.tasaDeCierre} %`}
          nota={`${n(r.ganadas, "ganada", "ganadas")} y ${n(r.perdidas, "perdida", "perdidas")}; ${n(r.descartadas, "descartada", "descartadas")} aparte`}
          href="/oportunidades?ver=cerradas"
        />
        <Cifra
          titulo="Litros estimados en juego"
          valor={`${enteros.format(r.litrosEstimados)} L`}
          nota="Volumen capturado en las oportunidades abiertas"
          href="/oportunidades"
        />
      </ul>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Abiertas por etapa</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {r.porEtapa.map((e) => (
                <li
                  key={e.etapa}
                  className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3"
                >
                  <span className="truncate">{e.label}</span>
                  <span className="h-2.5 rounded-xs bg-muted">
                    {e.cantidad > 0 ? (
                      <span
                        className="block h-full rounded-xs bg-chart-1"
                        style={{ width: `${(e.cantidad / maximo) * 100}%` }}
                      />
                    ) : null}
                  </span>
                  <span className="text-right font-medium tabular-nums">
                    {e.cantidad}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              Por qué no se cerraron
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                últimos {meses} meses
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {r.motivos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay oportunidades perdidas ni descartadas en el periodo.
              </p>
            ) : (
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-1.5 pr-4 font-medium">
                      Motivo
                    </th>
                    <th
                      scope="col"
                      className="py-1.5 pl-4 text-right font-medium"
                    >
                      Perdidas
                    </th>
                    <th
                      scope="col"
                      className="py-1.5 pl-4 text-right font-medium"
                    >
                      Descartadas
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {r.motivos.map((m) => (
                    <tr key={m.motivo}>
                      <th
                        scope="row"
                        className="py-1.5 pr-4 text-left font-normal"
                      >
                        {m.motivo}
                      </th>
                      <td className="py-1.5 pl-4 text-right">
                        {m.perdidas || "—"}
                      </td>
                      <td className="py-1.5 pl-4 text-right">
                        {m.descartadas || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              La tasa de cierre compara ganadas contra perdidas. Las descartadas
              (el prospecto no va por ahora) no cuentan como venta perdida.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
