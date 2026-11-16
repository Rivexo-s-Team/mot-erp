import Link from "next/link";
import { MuestrasLista } from "@/components/muestras-lista";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Muestra } from "@/lib/laboratorio/data";

type Props = {
  muestras: Muestra[];
  /** A dónde lleva "Registrar muestra"; vacío si el rol no las registra. */
  nuevaHref: string | null;
  vacio: string;
};

/** Muestras ligadas a una orden de servicio o a una oportunidad. */
export function MuestrasSeccion({ muestras, nuevaHref, vacio }: Props) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Muestras
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {muestras.length}
          </span>
        </h2>
        {nuevaHref ? (
          <Link
            href={nuevaHref}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "h-8",
            })}
          >
            Registrar muestra
          </Link>
        ) : null}
      </div>
      {muestras.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted-foreground">
          {vacio}
        </Card>
      ) : (
        <MuestrasLista muestras={muestras} sinCliente unaColumna />
      )}
    </section>
  );
}
