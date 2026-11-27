import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResumenOperacion } from "@/lib/direccion/operacion";
import { nombreMes } from "@/lib/direccion/tablero";
import { Cifra } from "./cifra";

const n = (c: number, uno: string, varios: string) =>
  `${c} ${c === 1 ? uno : varios}`;

/** Parte de operación del tablero: flota, visitas y laboratorio. */
export function Operacion({
  r,
  filtrosPorCambiar,
  meses,
}: {
  r: ResumenOperacion;
  filtrosPorCambiar: number;
  meses: number;
}) {
  return (
    <section aria-label="Operación">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">Operación</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cifra
          titulo="Robox en cliente"
          valor={`${r.robox.enCliente} de ${r.robox.enServicio}`}
          nota={
            r.robox.utilizacion === null
              ? "Sin Robox dados de alta"
              : `${r.robox.utilizacion} % de la flota en servicio`
          }
          href="/flota"
        />
        <Cifra
          titulo="Filtros por cambiar"
          valor={String(filtrosPorCambiar)}
          nota={
            filtrosPorCambiar > 0 ? (
              <span className="text-destructive">
                Por tiempo, por lectura o porque lo recomendó el laboratorio
              </span>
            ) : (
              "Ninguno pendiente"
            )
          }
          href="/flota"
        />
        <Cifra
          titulo={`Visitas cerradas · ${meses} meses`}
          valor={String(r.visitas.cerradas)}
          nota={
            <>
              {n(r.visitas.programadas, "programada", "programadas")} ·{" "}
              {r.visitas.enCurso} en curso
              {r.visitas.atrasadas > 0 ? (
                <span className="block text-destructive">
                  {n(r.visitas.atrasadas, "atrasada", "atrasadas")}
                </span>
              ) : null}
            </>
          }
          href="/ordenes"
        />
        <Cifra
          titulo={`Muestras · ${meses} meses`}
          valor={String(r.laboratorio.muestras)}
          nota={
            <>
              {r.laboratorio.enProceso} en proceso ·{" "}
              {n(
                r.laboratorio.informesValidados,
                "informe validado",
                "informes validados",
              )}
              {r.laboratorio.sinPublicar > 0 ? (
                <span className="block">
                  {r.laboratorio.sinPublicar} sin publicar en el portal
                </span>
              ) : null}
            </>
          }
          href="/laboratorio/muestras"
        />
      </ul>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Barras
          titulo="Robox por estado"
          filas={r.robox.porEstado.map((e) => ({
            clave: e.estado,
            label: e.label,
            cantidad: e.cantidad,
          }))}
        />
        <Barras
          titulo="Visitas cerradas por mes"
          filas={r.visitas.porMes.map((m) => ({
            clave: m.mes,
            label: nombreMes(m.mes),
            cantidad: m.cantidad,
          }))}
        />
      </div>
    </section>
  );
}

/** Lista de barras horizontales: una sola medida, con su número al lado. */
function Barras({
  titulo,
  filas,
}: {
  titulo: string;
  filas: { clave: string; label: string; cantidad: number }[];
}) {
  const maximo = Math.max(1, ...filas.map((f) => f.cantidad));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {filas.map((f) => (
            <li
              key={f.clave}
              className="grid grid-cols-[minmax(0,7rem)_1fr_2.5rem] items-center gap-3"
            >
              <span className="truncate">{f.label}</span>
              <span className="h-2.5 rounded-xs bg-muted">
                {f.cantidad > 0 ? (
                  <span
                    className="block h-full rounded-xs bg-chart-1"
                    style={{ width: `${(f.cantidad / maximo) * 100}%` }}
                  />
                ) : null}
              </span>
              <span className="text-right font-medium tabular-nums">
                {f.cantidad}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
