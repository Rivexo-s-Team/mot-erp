import { Badge } from "@/components/ui/badge";
import { ESTADOS_FACTURA, etiqueta } from "@/lib/facturacion/facturas";

/** Estado de una factura con un estilo distinto por estado. */
export function EstadoFacturaBadge({ estado }: { estado: string }) {
  return (
    <Badge
      variant={
        estado === "borrador"
          ? "secondary"
          : estado === "emitida"
            ? "default"
            : "outline"
      }
      className={estado === "cancelada" ? "text-muted-foreground" : undefined}
    >
      {etiqueta(ESTADOS_FACTURA, estado)}
    </Badge>
  );
}
