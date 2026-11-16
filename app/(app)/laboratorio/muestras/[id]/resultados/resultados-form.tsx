"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  interpretarValor,
  prepararResultados,
  type GrupoCaptura,
  type ParametroLab,
} from "@/lib/laboratorio/resultados";
import { guardarResultados } from "../../resultados-actions";

export type ParametroCaptura = ParametroLab & {
  /** Límite como se lee en el informe ("< 500", "Virgen ± 0.2"…). */
  limite: string;
  /** El nivel de análisis de la muestra no lo pide. */
  fueraDeNivel: boolean;
};

type Props = {
  muestraId: string;
  grupos: GrupoCaptura<ParametroCaptura>[];
  valores: Record<string, string>;
  cancelarHref: string;
};

/**
 * Captura de resultados de una muestra: un renglón por parámetro. Como
 * ConfigForm, empieza limpio en cada entrada nueva (`bfcacheId`) y usa ids
 * propios, porque Next conserva ocultas las páginas ya visitadas.
 */
export function ResultadosForm(props: Props) {
  const { bfcacheId } = useRouter();
  return <Formulario key={bfcacheId} {...props} />;
}

function Formulario({ muestraId, grupos, valores, cancelarHref }: Props) {
  const uid = useId();
  const [actuales, setActuales] = useState(valores);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const parametros = grupos.flatMap((g) => g.parametros);

  const cambiar = (id: string, valor: string) => {
    setActuales((a) => ({ ...a, [id]: valor }));
    if (errores[id])
      setErrores((e) =>
        Object.fromEntries(Object.entries(e).filter(([k]) => k !== id)),
      );
  };

  /** Al salir del campo se revisa y se deja como se va a guardar ("< 300" → "<300"). */
  const revisar = (p: ParametroCaptura) => {
    const r = interpretarValor(actuales[p.id] ?? "", p);
    if (r.ok) setActuales((a) => ({ ...a, [p.id]: r.texto }));
    else setErrores((e) => ({ ...e, [p.id]: r.error }));
  };

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();
    const preparado = prepararResultados(actuales, parametros);
    if (!preparado.ok) {
      setErrores(preparado.errores);
      setError("Revisa los valores marcados.");
      return;
    }
    setError(null);
    iniciar(async () => {
      const r = await guardarResultados(muestraId, actuales);
      if (r?.error) {
        setError(r.error);
        if (r.errores) setErrores(r.errores);
      }
    });
  };

  return (
    <form onSubmit={enviar} noValidate className="space-y-6">
      {grupos.map((g) => (
        <Card key={g.grupo}>
          <CardHeader>
            <CardTitle>{g.titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {g.parametros.map((p) => {
                const id = `${uid}-${p.id}`;
                const problema = errores[p.id];
                const detalle = [
                  p.unidad,
                  p.limite !== "—" ? `límite ${p.limite}` : null,
                  p.metodo,
                ].filter(Boolean);
                return (
                  <li
                    key={p.id}
                    className="grid gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_12rem] sm:items-center"
                  >
                    <label htmlFor={id} className="min-w-0 text-sm">
                      <span className="font-medium">{p.nombre}</span>
                      {detalle.length > 0 ? (
                        <span className="block text-muted-foreground">
                          {detalle.join(" · ")}
                        </span>
                      ) : null}
                      {p.fueraDeNivel || !p.activo ? (
                        <span className="block text-muted-foreground">
                          {p.activo
                            ? "No lo pide el nivel de análisis de esta muestra."
                            : "Parámetro desactivado en el catálogo."}
                        </span>
                      ) : null}
                    </label>
                    <Input
                      id={id}
                      name={p.id}
                      className="h-10"
                      autoComplete="off"
                      inputMode={p.grupo === "cualitativo" ? "text" : "decimal"}
                      value={actuales[p.id] ?? ""}
                      aria-invalid={Boolean(problema)}
                      aria-describedby={problema ? `${id}-error` : undefined}
                      onChange={(e) => cambiar(p.id, e.target.value)}
                      onBlur={() => revisar(p)}
                    />
                    {problema ? (
                      <p
                        id={`${id}-error`}
                        role="alert"
                        className="text-sm text-destructive sm:col-span-2"
                      >
                        {problema}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Deja vacío lo que no se midió. Se aceptan números (0.583), números
        acotados (&lt;300) y textos como “No detectado”.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={cancelarHref}
          className={buttonVariants({ variant: "outline", className: "h-10" })}
        >
          Cancelar
        </Link>
        <Button type="submit" className="h-10" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar resultados"}
        </Button>
      </div>
    </form>
  );
}
