import { Badge } from "@/components/ui/badge";
import { ESTADOS_ORDEN, etiqueta } from "@/lib/ordenes/campos";

/** Estado de una orden de servicio con un estilo distinto por estado. */
export function EstadoOrdenBadge({ estado }: { estado: string }) {
  const variante =
    estado === "en_curso"
      ? "default"
      : estado === "programada"
        ? "secondary"
        : "outline";
  return (
    <Badge
      variant={variante}
      className={estado === "cancelada" ? "text-muted-foreground" : undefined}
    >
      {etiqueta(ESTADOS_ORDEN, estado)}
    </Badge>
  );
}
