import { EstadoBadge } from "@/components/estado-badge";
import { ESTADOS_CONTRATO, etiqueta } from "@/lib/contratos/campos";

/** Estado de un contrato. */
export function EstadoContratoBadge({ estado }: { estado: string }) {
  return (
    <EstadoBadge tipo="contrato" estado={estado}>
      {etiqueta(ESTADOS_CONTRATO, estado)}
    </EstadoBadge>
  );
}
