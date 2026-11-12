import { Badge } from "@/components/ui/badge";
import { ESTADOS_CONTRATO, etiqueta } from "@/lib/contratos/campos";

/** Estado de un contrato con un estilo distinto por estado. */
export function EstadoContratoBadge({ estado }: { estado: string }) {
  const variante =
    estado === "vigente"
      ? "default"
      : estado === "borrador"
        ? "secondary"
        : "outline";
  return (
    <Badge
      variant={variante}
      className={variante === "outline" ? "text-muted-foreground" : undefined}
    >
      {etiqueta(ESTADOS_CONTRATO, estado)}
    </Badge>
  );
}
