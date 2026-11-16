"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { programarVisita } from "./actions";

/** Botón que crea la orden de servicio de una visita recurrente. */
export function ProgramarVisita({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        className="h-8"
        disabled={enviando}
        onClick={() =>
          iniciar(async () => {
            setError(null);
            const r = await programarVisita(id);
            if (r?.error) setError(r.error);
          })
        }
      >
        {enviando ? "Programando…" : "Programar"}
      </Button>
      {error ? (
        <p
          role="alert"
          className="max-w-56 text-right text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
