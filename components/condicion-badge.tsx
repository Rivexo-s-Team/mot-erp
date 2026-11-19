import { EstadoBadge } from "@/components/estado-badge";
import {
  CONDICIONES,
  type ResumenCondicion,
} from "@/lib/laboratorio/evaluacion";

type Props = {
  titulo: string;
  /** Vacío: no hay resultados que cuenten para esta condición. */
  resumen: ResumenCondicion | null;
};

/** Condición del aceite o de aditivos, con cuántas pruebas no pasan. */
export function CondicionBadge({ titulo, resumen }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{titulo}</span>
      {resumen ? (
        <>
          <EstadoBadge tipo="condicion" estado={resumen.condicion}>
            {CONDICIONES[resumen.condicion]}
          </EstadoBadge>
          <span className="text-muted-foreground">
            {resumen.noPasa === 0
              ? "todo pasa"
              : `${resumen.noPasa} no pasa${resumen.noPasa === 1 ? "" : "n"}`}{" "}
            de {resumen.capturados}
          </span>
        </>
      ) : (
        <span>Sin datos</span>
      )}
    </div>
  );
}
