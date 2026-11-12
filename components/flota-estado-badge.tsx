import { Badge } from "@/components/ui/badge";
import { etiquetaEstado } from "@/lib/flota/campos";

/** Estado de un Robox con un estilo distinto por estado. */
export function EstadoRoboxBadge({ estado }: { estado: string }) {
  const variante =
    estado === "en_cliente"
      ? "default"
      : estado === "disponible"
        ? "secondary"
        : "outline";
  return (
    <Badge
      variant={variante}
      className={estado === "baja" ? "text-muted-foreground" : undefined}
    >
      {etiquetaEstado(estado)}
    </Badge>
  );
}
