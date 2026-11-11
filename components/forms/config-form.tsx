"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  useForm,
  useWatch,
  type Control,
  type Resolver,
} from "react-hook-form";
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
  /** Texto de ayuda que cambia según lo que se va escribiendo, por campo. */
  ayudaDinamica?: (valores: Valores) => Partial<Record<string, string>>;
};

const INPUT_MODE = {
  numero: "decimal",
  entero: "numeric",
  telefono: "tel",
  correo: "email",
} as const;

/**
 * Formulario armado a partir de una lista de campos.
 *
 * Next conserva el estado de las páginas visitadas. Sin la llave `bfcacheId`,
 * al abrir otra vez "Agregar…" aparecería lo que se capturó la vez anterior.
 * Con ella, cada entrada nueva empieza limpia y "atrás" sí conserva el borrador.
 */
export function ConfigForm(props: ConfigFormProps) {
  const { bfcacheId } = useRouter();
  return <Formulario key={bfcacheId} {...props} />;
}

function Formulario({
  campos,
  valores,
  esEdicion,
  guardar,
  cancelarHref,
  textoGuardar,
  validar,
  eliminar,
  confirmarEliminar,
  ayudaDinamica,
}: ConfigFormProps) {
  // Next conserva ocultas las páginas anteriores: sin un prefijo propio, dos
  // formularios tendrían los mismos id y las etiquetas apuntarían al equivocado.
  const uid = useId();
  const idDe = (nombre: string) => `${uid}-${nombre}`;
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const {
    register,
    handleSubmit,
    control,
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
                  id={idDe(campo.name)}
                  type="checkbox"
                  className="size-4 accent-primary"
                  {...register(campo.name)}
                />
                <FieldLabel htmlFor={idDe(campo.name)} className="font-normal">
                  {campo.label}
                </FieldLabel>
              </Field>
            );
          }

          return (
            <Field key={campo.name} data-invalid={Boolean(fieldError)}>
              <FieldLabel htmlFor={idDe(campo.name)}>
                {campo.label}
                {campo.opcional ? (
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                ) : null}
              </FieldLabel>
              {campo.tipo === "opciones" || campo.tipo === "referencia" ? (
                <NativeSelect
                  id={idDe(campo.name)}
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
                  id={idDe(campo.name)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
                  aria-invalid={Boolean(fieldError)}
                  {...register(campo.name)}
                />
              ) : (
                <Input
                  id={idDe(campo.name)}
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
              {ayudaDinamica ? (
                <AyudaCampo
                  control={control}
                  nombre={campo.name}
                  calcular={ayudaDinamica}
                />
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

type AyudaCampoProps = {
  control: Control<Valores>;
  nombre: string;
  calcular: (valores: Valores) => Partial<Record<string, string>>;
};

/** Ayuda que cambia al escribir. Va aparte para no repintar todo el formulario. */
function AyudaCampo({ control, nombre, calcular }: AyudaCampoProps) {
  const valores = useWatch({ control });
  const texto = calcular(valores as Valores)[nombre];
  return texto ? (
    <p className="rounded-md bg-accent px-2.5 py-1.5 text-sm text-accent-foreground">
      {texto}
    </p>
  ) : null;
}
