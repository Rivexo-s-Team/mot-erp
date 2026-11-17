import {
  CONDICIONES,
  type ResumenCondicion,
} from "@/lib/laboratorio/evaluacion";
import {
  formatDesviacion,
  type ContenidoInforme,
} from "@/lib/laboratorio/informe";
import { formatDia } from "@/lib/format";
import {
  etiqueta,
  NIVELES_ANALISIS,
  TIPOS_MUESTRA,
} from "@/lib/laboratorio/muestras";

const celda = "px-3 py-1.5 text-right align-top whitespace-nowrap tabular-nums";
const primera =
  "sticky left-0 z-10 bg-card px-3 py-1.5 text-left align-top font-normal";

function Condicion({ resumen }: { resumen: ResumenCondicion | null }) {
  if (!resumen) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={
        resumen.condicion === "critico"
          ? "font-medium text-destructive"
          : resumen.condicion === "precaucion"
            ? "font-medium"
            : undefined
      }
    >
      {CONDICIONES[resumen.condicion]}
    </span>
  );
}

/**
 * Tabla de tendencias del informe: una columna por muestra y un renglón por
 * parámetro, como el informe FOLAB. En celular se desliza hacia los lados y
 * el nombre del parámetro se queda fijo.
 */
export function InformeTendencias({
  contenido,
}: {
  contenido: ContenidoInforme;
}) {
  const { muestras, grupos } = contenido;
  const columnas = muestras.length + 3;
  return (
    // `relative`: sin él, los textos solo para lector de pantalla se salen del cuadro y ensanchan la página.
    <div className="relative overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th scope="col" className={`${primera} text-muted-foreground`}>
              Muestra
            </th>
            {muestras.map((m) => (
              <th key={m.id} scope="col" className={`${celda} font-medium`}>
                {m.idMuestra}
              </th>
            ))}
            <th
              scope="col"
              className={`${celda} font-normal text-muted-foreground`}
            >
              Límite
            </th>
            <th
              scope="col"
              className={`${celda} font-normal text-muted-foreground`}
            >
              Desviación
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className={`${primera} text-muted-foreground`}>
              Tipo
            </th>
            {muestras.map((m) => (
              <td key={m.id} className={celda}>
                {etiqueta(TIPOS_MUESTRA, m.tipo).replace(/ \(.*\)$/, "")}
              </td>
            ))}
            <td colSpan={2} />
          </tr>
          <tr>
            <th scope="row" className={`${primera} text-muted-foreground`}>
              Fecha de muestreo
            </th>
            {muestras.map((m) => (
              <td key={m.id} className={celda}>
                {formatDia(m.fecha)}
              </td>
            ))}
            <td colSpan={2} />
          </tr>
          <tr>
            <th scope="row" className={`${primera} text-muted-foreground`}>
              Análisis
            </th>
            {muestras.map((m) => (
              <td key={m.id} className={celda}>
                {m.nivel ? etiqueta(NIVELES_ANALISIS, m.nivel) : "—"}
              </td>
            ))}
            <td colSpan={2} />
          </tr>
          <tr className="border-t">
            <th scope="row" className={primera}>
              Condición del aceite
            </th>
            {muestras.map((m) => (
              <td key={m.id} className={celda}>
                <Condicion resumen={m.aceite} />
              </td>
            ))}
            <td colSpan={2} />
          </tr>
          <tr>
            <th scope="row" className={primera}>
              Condición de aditivos
            </th>
            {muestras.map((m) => (
              <td key={m.id} className={celda}>
                <Condicion resumen={m.aditivos} />
              </td>
            ))}
            <td colSpan={2} />
          </tr>
          {grupos.map((g) => (
            <GrupoFilas key={g.grupo} grupo={g} columnas={columnas} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GrupoFilas({
  grupo,
  columnas,
}: {
  grupo: ContenidoInforme["grupos"][number];
  columnas: number;
}) {
  return (
    <>
      <tr className="border-t bg-muted/50">
        <th
          scope="colgroup"
          colSpan={columnas}
          className="sticky left-0 px-3 py-1.5 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {grupo.titulo}
        </th>
      </tr>
      {grupo.filas.map((f) => (
        <tr key={f.parametroId} className="border-t">
          <th scope="row" className={primera}>
            {f.nombre}
            {f.unidad ? (
              <span className="ml-1 text-muted-foreground">{f.unidad}</span>
            ) : null}
          </th>
          {f.valores.map((v, i) => (
            <td
              key={i}
              className={`${celda} ${v?.veredicto === "no_pasa" ? "font-medium text-destructive" : ""}`}
              title={
                v?.veredicto === "no_pasa"
                  ? "No pasa"
                  : v?.veredicto === "pasa"
                    ? "Pasa"
                    : undefined
              }
            >
              {v ? v.texto : <span className="text-muted-foreground">—</span>}
              {v?.veredicto === "no_pasa" ? (
                <span className="sr-only"> (no pasa)</span>
              ) : null}
            </td>
          ))}
          <td className={`${celda} text-muted-foreground`}>{f.limite ?? ""}</td>
          <td className={`${celda} text-muted-foreground`}>
            {formatDesviacion(f.desviacion)}
          </td>
        </tr>
      ))}
    </>
  );
}
