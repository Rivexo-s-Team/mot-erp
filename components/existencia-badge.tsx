import { Badge } from "@/components/ui/badge";
import { nivelExistencia } from "@/lib/inventario/campos";

/** Cuántas piezas hay, resaltando lo agotado y lo que quedó en negativo. */
export function ExistenciaBadge({ existencia }: { existencia: number }) {
  const nivel = nivelExistencia(existencia);
  return (
    <Badge
      variant={
        nivel === "negativa"
          ? "destructive"
          : nivel === "agotada"
            ? "outline"
            : "secondary"
      }
      className="tabular-nums"
    >
      {existencia}
    </Badge>
  );
}
