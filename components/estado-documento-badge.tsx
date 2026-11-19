import { EstadoBadge } from "@/components/estado-badge";
import { ETIQUETA_ESTADO, type RenglonAcceso } from "@/lib/acceso/documentos";

/** Estado de un documento de acceso: vigente, por vencer, vencido o falta. */
export function EstadoDocumentoBadge({
  estado,
}: {
  estado: RenglonAcceso["estado"];
}) {
  return (
    <EstadoBadge tipo="documento" estado={estado}>
      {ETIQUETA_ESTADO[estado]}
    </EstadoBadge>
  );
}
