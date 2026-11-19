import { Badge } from "@/components/ui/badge";
import { tonoDeEstado, VARIANTE_DE_TONO, type TipoEstado } from "@/lib/estados";

type Props = {
  tipo: TipoEstado;
  estado: string;
  children: React.ReactNode;
  className?: string;
};

/** Etiqueta de estado con el color que le toca en todo el sistema (lib/estados.ts). */
export function EstadoBadge({ tipo, estado, children, className }: Props) {
  return (
    <Badge
      variant={VARIANTE_DE_TONO[tonoDeEstado(tipo, estado)]}
      className={className}
    >
      {children}
    </Badge>
  );
}
