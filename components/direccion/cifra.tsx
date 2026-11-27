import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Una cifra del tablero, con su nota y el enlace a la pantalla de donde sale. */
export function Cifra({
  titulo,
  valor,
  nota,
  href,
}: {
  titulo: string;
  valor: string;
  nota: ReactNode;
  href: string;
}) {
  return (
    <li>
      <Link href={href} className="block h-full">
        <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
          <p className="text-sm text-muted-foreground">{titulo}</p>
          <p className="text-xl font-semibold tabular-nums">{valor}</p>
          <p className="text-sm text-muted-foreground">{nota}</p>
        </Card>
      </Link>
    </li>
  );
}
