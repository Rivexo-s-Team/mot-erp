import { EstadoBadge } from "@/components/estado-badge";
import { ESTADOS_FACTURA, etiqueta } from "@/lib/facturacion/facturas";

/** Estado de una factura. */
export function EstadoFacturaBadge({ estado }: { estado: string }) {
  return (
    <EstadoBadge tipo="factura" estado={estado}>
      {etiqueta(ESTADOS_FACTURA, estado)}
    </EstadoBadge>
  );
}
