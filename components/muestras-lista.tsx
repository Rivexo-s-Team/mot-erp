import Link from "next/link";
import { EstadoMuestraBadge } from "@/components/muestra-estado-badge";
import { Card } from "@/components/ui/card";
import { nombreEquipo } from "@/lib/flota/campos";
import { formatDia } from "@/lib/format";
import type { Muestra } from "@/lib/laboratorio/data";
import {
  etiqueta,
  NIVELES_ANALISIS,
  TIPOS_MUESTRA,
} from "@/lib/laboratorio/muestras";

type Props = {
  muestras: Muestra[];
  /** Dentro de la ficha de un cliente u orden no hace falta repetir el cliente. */
  sinCliente?: boolean;
  /** Para columnas angostas (la ficha de una orden). */
  unaColumna?: boolean;
};

/** Tarjetas de muestras; cada una lleva a su ficha. */
export function MuestrasLista({ muestras, sinCliente, unaColumna }: Props) {
  return (
    <ul className={`grid gap-3 ${unaColumna ? "" : "lg:grid-cols-2"}`}>
      {muestras.map((m) => (
        <li key={m.id}>
          <Link href={`/laboratorio/muestras/${m.id}`} className="block h-full">
            <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium tabular-nums">{m.id_muestra}</p>
                <EstadoMuestraBadge estado={m.estado} />
              </div>
              <p className="text-sm break-words">
                {sinCliente ? "" : `${m.cuentas?.nombre ?? "—"} · `}
                {m.equipos_cliente ? nombreEquipo(m.equipos_cliente) : "—"}
                {m.plantas ? ` · ${m.plantas.nombre}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {etiqueta(TIPOS_MUESTRA, m.tipo)} · tomada el{" "}
                {formatDia(m.fecha_muestreo)}
                {m.nivel_analisis
                  ? ` · ${etiqueta(NIVELES_ANALISIS, m.nivel_analisis)}`
                  : ""}
              </p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
