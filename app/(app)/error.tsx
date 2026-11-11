"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Se muestra cuando una página o una acción del sistema falla. */
export default function AppError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <Card className="mx-auto max-w-md items-center gap-3 px-6 py-10 text-center">
      <h1 className="text-lg font-semibold">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        No se pudo completar la operación. Intenta de nuevo; si el problema
        sigue, avisa a Rivexo.
      </p>
      <Button onClick={reset} className="h-10">
        Intentar de nuevo
      </Button>
    </Card>
  );
}
