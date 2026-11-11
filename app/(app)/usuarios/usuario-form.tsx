"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
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
  PASSWORD_MIN,
  usuarioFormSchema,
  type UsuarioFormValues,
} from "@/lib/auth/schemas";
import { crearUsuario, editarUsuario } from "./actions";

type Rol = { id: string; nombre: string };

type UsuarioFormProps = {
  roles: Rol[];
  /** Si viene, el formulario edita ese usuario; si no, crea uno nuevo. */
  usuario?: {
    id: string;
    nombre: string;
    correo: string;
    puesto: string | null;
    rolId: string;
    activo: boolean;
  };
};

type Valores = UsuarioFormValues;

/** Cada entrada nueva al formulario empieza limpia (ver ConfigForm). */
export function UsuarioForm(props: UsuarioFormProps) {
  const { bfcacheId } = useRouter();
  return <Formulario key={bfcacheId} {...props} />;
}

function Formulario({ roles, usuario }: UsuarioFormProps) {
  // Prefijo propio: Next conserva ocultas las páginas anteriores y los id se repetirían.
  const uid = useId();
  const esEdicion = Boolean(usuario);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(usuarioFormSchema(esEdicion)),
    defaultValues: {
      nombre: usuario?.nombre ?? "",
      correo: usuario?.correo ?? "",
      puesto: usuario?.puesto ?? "",
      rolId: usuario?.rolId ?? "",
      activo: usuario?.activo ?? true,
      password: "",
    },
  });

  async function onSubmit(values: Valores) {
    setError(null);
    const result = usuario
      ? await editarUsuario({ ...values, id: usuario.id })
      : await crearUsuario(values);
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

        <Field data-invalid={Boolean(errors.nombre)}>
          <FieldLabel htmlFor={`${uid}-nombre`}>Nombre completo</FieldLabel>
          <Input
            id={`${uid}-nombre`}
            className="h-10"
            autoComplete="off"
            {...register("nombre")}
          />
          <FieldError errors={[errors.nombre]} />
        </Field>

        <Field data-invalid={Boolean(errors.correo)}>
          <FieldLabel htmlFor={`${uid}-correo`}>Correo</FieldLabel>
          <Input
            id={`${uid}-correo`}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="off"
            className="h-10"
            readOnly={esEdicion}
            {...register("correo")}
          />
          {esEdicion ? (
            <FieldDescription>
              El correo de acceso no se puede cambiar.
            </FieldDescription>
          ) : null}
          <FieldError errors={[errors.correo]} />
        </Field>

        <Field data-invalid={Boolean(errors.puesto)}>
          <FieldLabel htmlFor={`${uid}-puesto`}>Puesto (opcional)</FieldLabel>
          <Input
            id={`${uid}-puesto`}
            className="h-10"
            autoComplete="off"
            {...register("puesto")}
          />
          <FieldError errors={[errors.puesto]} />
        </Field>

        <Field data-invalid={Boolean(errors.rolId)}>
          <FieldLabel htmlFor={`${uid}-rolId`}>Rol</FieldLabel>
          <NativeSelect
            id={`${uid}-rolId`}
            className="h-10 w-full"
            {...register("rolId")}
          >
            <NativeSelectOption value="">Elige un rol…</NativeSelectOption>
            {roles.map((rol) => (
              <NativeSelectOption key={rol.id} value={rol.id}>
                {rol.nombre}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.rolId]} />
        </Field>

        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor={`${uid}-password`}>
            {esEdicion ? "Nueva contraseña (opcional)" : "Contraseña temporal"}
          </FieldLabel>
          <Input
            id={`${uid}-password`}
            type="text"
            autoComplete="off"
            className="h-10 font-mono"
            {...register("password")}
          />
          <FieldDescription>
            {esEdicion
              ? "Déjala vacía para no cambiarla."
              : `Mínimo ${PASSWORD_MIN} caracteres. Compártela con la persona por un medio seguro.`}
          </FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>

        {esEdicion ? (
          <Field orientation="horizontal">
            <input
              id={`${uid}-activo`}
              type="checkbox"
              className="size-4 accent-primary"
              {...register("activo")}
            />
            <FieldLabel htmlFor={`${uid}-activo`} className="font-normal">
              Usuario activo (puede entrar al sistema)
            </FieldLabel>
          </Field>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            href="/usuarios"
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
                : "Crear usuario"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
