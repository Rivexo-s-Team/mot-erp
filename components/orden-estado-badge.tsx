import { EstadoBadge } from "@/components/estado-badge";
import { ESTADOS_ORDEN, etiqueta } from "@/lib/ordenes/campos";

/** Estado de una orden de servicio. */
export function EstadoOrdenBadge({ estado }: { estado: string }) {
  return (
    <EstadoBadge tipo="orden" estado={estado}>
      {etiqueta(ESTADOS_ORDEN, estado)}
    </EstadoBadge>
  );
}
