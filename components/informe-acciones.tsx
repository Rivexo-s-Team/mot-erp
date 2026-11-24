"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  publicarInforme,
  reabrirInforme,
  validarInforme,
} from "@/app/(app)/laboratorio/informes/actions";

type Props = {
  informeId: string;
  accion: "validar" | "reabrir" | "publicar" | "retirar";
};

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
      "¿Reabrir el informe? Se borra la validación y vuelve a borrador; habrá que validarlo de nuevo. Si estaba publicado, el cliente deja de verlo.",
  },
  publicar: {
    boton: "Publicar en el portal",
    ocupado: "Publicando…",
    confirmar:
      "¿Publicar el informe? Los usuarios del portal de este cliente podrán verlo y descargar su PDF.",
  },
  retirar: {
    boton: "Retirar del portal",
    ocupado: "Retirando…",
    confirmar: "¿Retirar el informe del portal? El cliente dejará de verlo.",
  },
};

/** Botón para validar un informe, reabrirlo, o publicarlo en el portal y retirarlo. */
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
        : accion === "reabrir"
          ? reabrirInforme(informeId)
          : publicarInforme(informeId, accion === "publicar"));
      if (r?.error) setError(r.error);
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={
          accion === "validar" || accion === "publicar" ? "default" : "outline"
        }
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
