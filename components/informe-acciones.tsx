"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  reabrirInforme,
  validarInforme,
} from "@/app/(app)/laboratorio/informes/actions";

type Props = { informeId: string; accion: "validar" | "reabrir" };

const TEXTOS = {
  validar: {
    boton: "Validar informe",
    ocupado: "Validando…",
    confirmar:
      "¿Validar el informe? Queda fijo tal como se ve ahora: ya no cambia aunque después se corrijan resultados o límites.",
  },
  reabrir: {
    boton: "Reabrir para corregir",
    ocupado: "Reabriendo…",
    confirmar:
      "¿Reabrir el informe? Se borra la validación y vuelve a borrador; habrá que validarlo de nuevo.",
  },
};

/** Botón para validar un informe o reabrir uno ya validado. */
export function InformeAccion({ informeId, accion }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const t = TEXTOS[accion];

  const ejecutar = () => {
    if (!window.confirm(t.confirmar)) return;
    setError(null);
    iniciar(async () => {
      const r = await (accion === "validar"
        ? validarInforme(informeId)
        : reabrirInforme(informeId));
      if (r?.error) setError(r.error);
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={accion === "validar" ? "default" : "outline"}
        className="h-8"
        disabled={ocupado}
        onClick={ejecutar}
      >
        {ocupado ? t.ocupado : t.boton}
      </Button>
      {error ? (
        <Alert variant="destructive" className="basis-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
