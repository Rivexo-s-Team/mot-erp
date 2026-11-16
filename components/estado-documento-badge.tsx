import { Badge } from "@/components/ui/badge";
import { ETIQUETA_ESTADO, type RenglonAcceso } from "@/lib/acceso/documentos";

/** Estado de un documento de acceso: vigente, por vencer, vencido o falta. */
export function EstadoDocumentoBadge({
  estado,
}: {
  estado: RenglonAcceso["estado"];
}) {
  return (
    <Badge
      variant={
        estado === "vigente"
          ? "secondary"
          : estado === "por_vencer"
            ? "default"
            : "destructive"
      }
    >
      {ETIQUETA_ESTADO[estado]}
    </Badge>
  );
}
