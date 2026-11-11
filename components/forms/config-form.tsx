"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  esquemaCampos,
  type Campo,
  type Validador,
  type Valores,
} from "@/lib/forms/campos";

type Resultado = { error: string } | undefined;

type ConfigFormProps = {
  campos: Campo[];
  valores: Valores;
  esEdicion: boolean;
  /** Guarda en el servidor. Si todo sale bien, redirige. */
  guardar: (valores: Valores) => Promise<Resultado>;
  cancelarHref: string;
  textoGuardar: string;
  /** Validación entre campos (opcional). */
  validar?: Validador;
  /** Si viene, muestra el botón Eliminar. */
  eliminar?: () => Promise<Resultado>;
  confirmarEliminar?: string;
};

const INPUT_MODE = {
  numero: "decimal",
  entero: "numeric",
  telefono: "tel",
  correo: "email",
} as const;

/** Formulario armado a partir de una lista de campos. */
export function ConfigForm({
  campos,
  valores,
  esEdicion,
  guardar,
  cancelarHref,
  textoGuardar,
  validar,
  eliminar,
  confirmarEliminar,
}: ConfigFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    // Los campos llegan como datos, por eso el tipo se fija a mano.
    resolver: zodResolver(esquemaCampos(campos, validar)) as Resolver<Valores>,
    defaultValues: valores,
  });

  async function onSubmit(values: Valores) {
    setError(null);
    const result = await guardar(values);
    if (result?.error) setError(result.error);
  }

  async function onEliminar() {
    if (
      !eliminar ||
      !window.confirm(confirmarEliminar ?? "¿Eliminar este registro?")
    )
      return;
    setError(null);
    setEliminando(true);
    const result = await eliminar();
    if (result?.error) {
      setError(result.error);
      setEliminando(false);
    }
  }

  const ocupado = isSubmitting || eliminando;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {campos.map((campo) => {
          const fieldError = errors[campo.name];
          const bloqueado = esEdicion && campo.soloAlCrear;

          if (campo.tipo === "casilla") {
            return (
              <Field key={campo.name} orientation="horizontal">
                <input
                  id={campo.name}
                  type="checkbox"
                  className="size-4 accent-primary"
                  {...register(campo.name)}
                />
                <FieldLabel htmlFor={campo.name} className="font-normal">
                  {campo.label}
                </FieldLabel>
              </Field>
            );
          }

          return (
            <Field key={campo.name} data-invalid={Boolean(fieldError)}>
              <FieldLabel htmlFor={campo.name}>
                {campo.label}
                {campo.opcional ? (
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                ) : null}
              </FieldLabel>
              {campo.tipo === "opciones" || campo.tipo === "referencia" ? (
                <NativeSelect
                  id={campo.name}
                  className="h-10 w-full"
                  {...register(campo.name)}
                >
                  <NativeSelectOption value="">
                    {campo.opcional ? "Ninguno" : "Elige una opción…"}
                  </NativeSelectOption>
                  {campo.opciones?.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : campo.tipo === "textoLargo" ? (
                <textarea
                  id={campo.name}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
                  aria-invalid={Boolean(fieldError)}
                  {...register(campo.name)}
                />
              ) : (
                <Input
                  id={campo.name}
                  className={campo.mayusculas ? "h-10 uppercase" : "h-10"}
                  autoComplete="off"
                  autoCapitalize={campo.tipo === "correo" ? "none" : undefined}
                  inputMode={
                    campo.tipo in INPUT_MODE
                      ? INPUT_MODE[campo.tipo as keyof typeof INPUT_MODE]
                      : "text"
                  }
                  type={campo.tipo === "fecha" ? "date" : "text"}
                  readOnly={bloqueado}
                  aria-invalid={Boolean(fieldError)}
                  {...register(campo.name)}
                />
              )}
              {campo.ayuda || bloqueado ? (
                <FieldDescription>
                  {bloqueado
                    ? "No se puede cambiar después de crearlo."
                    : campo.ayuda}
                </FieldDescription>
              ) : null}
              <FieldError errors={[fieldError]} />
            </Field>
          );
        })}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {eliminar ? (
            <Button
              type="button"
              variant="destructive"
              className="h-10 sm:mr-auto"
              disabled={ocupado}
              onClick={onEliminar}
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </Button>
          ) : null}
          <Link
            href={cancelarHref}
            className={buttonVariants({
              variant: "outline",
              className: eliminar ? "h-10" : "h-10 sm:ml-auto",
            })}
          >
            Cancelar
          </Link>
          <Button type="submit" className="h-10" disabled={ocupado}>
            {isSubmitting ? "Guardando…" : textoGuardar}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
