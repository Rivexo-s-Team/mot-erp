import { Badge } from "@/components/ui/badge";
import { ESTADOS_MUESTRA, etiqueta } from "@/lib/laboratorio/muestras";

/** Estado de una muestra con un estilo distinto por estado. */
export function EstadoMuestraBadge({ estado }: { estado: string }) {
  const variante =
    estado === "en_analisis"
      ? "default"
      : estado === "pendiente" || estado === "recibida"
        ? "secondary"
        : "outline";
  return (
    <Badge
      variant={variante}
      className={estado === "cancelada" ? "text-muted-foreground" : undefined}
    >
      {etiqueta(ESTADOS_MUESTRA, estado)}
    </Badge>
  );
}
