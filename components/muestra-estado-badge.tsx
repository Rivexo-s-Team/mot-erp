import { EstadoBadge } from "@/components/estado-badge";
import { ESTADOS_MUESTRA, etiqueta } from "@/lib/laboratorio/muestras";

/** Estado de una muestra. */
export function EstadoMuestraBadge({ estado }: { estado: string }) {
  return (
    <EstadoBadge tipo="muestra" estado={estado}>
      {etiqueta(ESTADOS_MUESTRA, estado)}
    </EstadoBadge>
  );
}
