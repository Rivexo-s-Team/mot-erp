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
  esquemaCatalogo,
  getCatalogo,
  type Valores,
} from "@/lib/catalogos/config";
import { guardarCatalogo } from "./actions";

type CatalogoFormProps = {
  slug: string;
  /** null = registro nuevo. */
  id: string | null;
  valores: Valores;
};

export function CatalogoForm({ slug, id, valores }: CatalogoFormProps) {
  // La configuración tiene funciones, así que se busca aquí y no se pasa como prop.
  const catalogo = getCatalogo(slug)!;
  const esEdicion = id !== null;
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    // Los campos salen de la configuración, por eso el tipo se fija a mano.
    resolver: zodResolver(esquemaCatalogo(catalogo)) as Resolver<Valores>,
    defaultValues: valores,
  });

  async function onSubmit(values: Valores) {
    setError(null);
    const result = await guardarCatalogo(slug, id, values);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {catalogo.campos.map((campo) => {
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
              {campo.tipo === "opciones" ? (
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
              ) : (
                <Input
                  id={campo.name}
                  className="h-10"
                  autoComplete="off"
                  inputMode={
                    campo.tipo === "numero"
                      ? "decimal"
                      : campo.tipo === "entero"
                        ? "numeric"
                        : "text"
                  }
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

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            href={`/catalogos/${slug}`}
            className={buttonVariants({
              variant: "outline",
              className: "h-10",
            })}
          >
            Cancelar
          </Link>
          <Button type="submit" className="h-10" disabled={isSubmitting}>
            {isSubmitting
              ? "Guardando…"
              : esEdicion
                ? "Guardar cambios"
                : `Agregar ${catalogo.singular}`}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
