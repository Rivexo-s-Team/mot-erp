import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export type Columna<T> = {
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** Importes y cantidades: alineados a la derecha. */
  derecha?: boolean;
};

type Props<T> = {
  filas: T[];
  columnas: Columna<T>[];
  clave: (fila: T) => string;
  /** A dónde lleva el renglón (desde su primera columna); vacío si no lleva a nada. */
  href: (fila: T) => string | null;
};

/**
 * Lista como tabla, para escritorio (en celular las listas son tarjetas).
 * La primera columna es el enlace a la ficha.
 */
export function TablaLista<T>({ filas, columnas, clave, href }: Props<T>) {
  return (
    <Card className="hidden overflow-x-auto py-0 lg:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {columnas.map((c) => (
              <th
                key={c.titulo}
                scope="col"
                className={`px-4 py-2.5 font-medium whitespace-nowrap ${c.derecha ? "text-right" : ""}`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map((f) => {
            const destino = href(f);
            return (
              <tr
                key={clave(f)}
                className="transition-colors hover:bg-accent/40"
              >
                {columnas.map((c, i) => (
                  <td
                    key={c.titulo}
                    className={`px-4 py-2.5 align-top ${c.derecha ? "text-right tabular-nums whitespace-nowrap" : ""}`}
                  >
                    {i === 0 && destino ? (
                      <Link
                        href={destino}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {c.celda(f)}
                      </Link>
                    ) : (
                      c.celda(f)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
