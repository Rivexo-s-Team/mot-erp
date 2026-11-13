"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { claveBorrador, leerBorrador } from "@/lib/ordenes/captura";
import { cerrarOrden } from "@/app/(app)/ordenes/actions";

type Props = {
  ordenId: string;
  /** Lo que falta para cerrar (firmas). Vacío = se puede cerrar. */
  faltantes: string[];
  volver: "ordenes" | "campo";
  /** Botón grande, para el celular. */
  grande?: boolean;
};

/** ¿Hay en este teléfono cambios de la captura que aún no llegan al sistema? */
function hayPendiente(ordenId: string): boolean {
  try {
    return Boolean(
      leerBorrador(window.localStorage.getItem(claveBorrador(ordenId)))
        ?.pendiente,
    );
  } catch {
    return false;
  }
}

/** Botón para cerrar la orden. Una orden cerrada ya no se puede cambiar. */
export function CerrarOrden({ ordenId, faltantes, volver, grande }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  if (faltantes.length > 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Para cerrar la orden falta {faltantes.join(" y ")}.
      </p>
    );
  }

  const cerrar = () => {
    if (hayPendiente(ordenId)) {
      setError(
        "En este teléfono hay cambios de la captura sin enviar. Abre la captura y espera a que diga “Guardado en el sistema”.",
      );
      return;
    }
    if (
      !window.confirm(
        "¿Cerrar la orden? Después ya no se podrá cambiar nada: ni la captura, ni las fotos, ni las firmas.",
      )
    )
      return;
    setError(null);
    // El borrador del teléfono ya está enviado (se revisó arriba): se limpia
    // antes de cerrar, porque al cerrar la pantalla cambia de inmediato.
    try {
      window.localStorage.removeItem(claveBorrador(ordenId));
    } catch {
      // Sin almacenamiento: no hay borrador que limpiar.
    }
    iniciar(async () => {
      const r = await cerrarOrden(ordenId, volver);
      if (r?.error) setError(r.error);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={cerrar}
        disabled={enviando}
        className={grande ? "h-12 w-full text-base" : "h-8"}
        size={grande ? "default" : "sm"}
      >
        {enviando ? "Cerrando…" : "Cerrar orden"}
      </Button>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
