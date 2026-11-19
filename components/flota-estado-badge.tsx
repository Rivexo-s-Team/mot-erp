import { EstadoBadge } from "@/components/estado-badge";
import { etiquetaEstado } from "@/lib/flota/campos";

/** Estado de un Robox. */
export function EstadoRoboxBadge({ estado }: { estado: string }) {
  return (
    <EstadoBadge tipo="robox" estado={estado}>
      {etiquetaEstado(estado)}
    </EstadoBadge>
  );
}
