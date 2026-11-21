"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { moverEtapa } from "./actions";

const TIPO = "application/x-mot-oportunidad";

/** Tarjeta que se puede arrastrar a otra etapa (solo para quien edita oportunidades). */
export function TarjetaArrastrable({
  id,
  etapa,
  activa,
  children,
}: {
  id: string;
  etapa: string;
  activa: boolean;
  children: ReactNode;
}) {
  if (!activa) return <>{children}</>;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(TIPO, JSON.stringify({ id, etapa }));
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

/** Columna del tablero: al soltar una tarjeta, la oportunidad pasa a esta etapa. */
export function ColumnaEtapa({
  etapa,
  nombre,
  activa,
  className,
  children,
}: {
  etapa: string;
  nombre: string;
  activa: boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [encima, setEncima] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, iniciar] = useTransition();

  if (!activa)
    return (
      <section className={className} aria-label={nombre}>
        {children}
      </section>
    );

  return (
    <section
      aria-label={nombre}
      aria-busy={moviendo}
      className={`${className ?? ""} rounded-xl transition-colors ${encima ? "bg-accent/60 outline-2 outline-primary/40 outline-dashed" : ""} ${moviendo ? "opacity-60" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TIPO)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setEncima(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setEncima(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        let dato: { id?: string; etapa?: string };
        try {
          dato = JSON.parse(e.dataTransfer.getData(TIPO));
        } catch {
          return;
        }
        const { id, etapa: origen } = dato;
        if (!id || origen === etapa) return;
        setError(null);
        // Perder o descartar pide el motivo: se captura en la ficha.
        if (etapa === "perdida" || etapa === "descartada") {
          router.push(`/oportunidades/${id}?marcar=${etapa}`);
          return;
        }
        iniciar(async () => {
          const r = await moverEtapa(id, etapa);
          if (r?.error) setError(r.error);
        });
      }}
    >
      {children}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
