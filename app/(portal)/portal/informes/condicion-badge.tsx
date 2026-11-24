import { Badge } from "@/components/ui/badge";
import { CONDICIONES } from "@/lib/laboratorio/evaluacion";

/** Condición general del aceite, con el código de colores del sistema. */
export function CondicionBadge({
  condicion,
}: {
  condicion: keyof typeof CONDICIONES;
}) {
  return (
    <Badge
      variant={
        condicion === "critico"
          ? "destructive"
          : condicion === "precaucion"
            ? "aviso"
            : "exito"
      }
    >
      {CONDICIONES[condicion]}
    </Badge>
  );
}
