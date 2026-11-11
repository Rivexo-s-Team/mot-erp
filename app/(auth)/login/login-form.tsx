"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { iniciarSesion } from "@/app/(auth)/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";

export function LoginForm() {
  // Prefijo propio: Next conserva ocultas las páginas anteriores y los id se repetirían.
  const uid = useId();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { correo: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setError(null);
    const result = await iniciarSesion(values);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="text-left">
      <FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Field data-invalid={Boolean(errors.correo)}>
          <FieldLabel htmlFor={`${uid}-correo`}>Correo</FieldLabel>
          <Input
            id={`${uid}-correo`}
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            className="h-10"
            aria-invalid={Boolean(errors.correo)}
            {...register("correo")}
          />
          <FieldError errors={[errors.correo]} />
        </Field>
        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor={`${uid}-password`}>Contraseña</FieldLabel>
          <Input
            id={`${uid}-password`}
            type="password"
            autoComplete="current-password"
            className="h-10"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Entrando…" : "Entrar"}
        </Button>
      </FieldGroup>
    </form>
  );
}
