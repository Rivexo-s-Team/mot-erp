"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  cambiarPasswordSchema,
  PASSWORD_MIN,
  type CambiarPasswordInput,
} from "@/lib/auth/schemas";
import { cambiarPassword } from "./actions";

export function PasswordForm() {
  // Prefijo propio: Next conserva ocultas las páginas anteriores y los id se repetirían.
  const uid = useId();
  const [estado, setEstado] = useState<{
    tipo: "ok" | "error";
    mensaje: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CambiarPasswordInput>({
    resolver: zodResolver(cambiarPasswordSchema),
    defaultValues: { password: "", confirmar: "" },
  });

  async function onSubmit(values: CambiarPasswordInput) {
    setEstado(null);
    const result = await cambiarPassword(values);
    if (result && "error" in result) {
      setEstado({ tipo: "error", mensaje: result.error });
      return;
    }
    reset();
    setEstado({ tipo: "ok", mensaje: "Tu contraseña se cambió." });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {estado ? (
          <Alert variant={estado.tipo === "error" ? "destructive" : "default"}>
            <AlertDescription>{estado.mensaje}</AlertDescription>
          </Alert>
        ) : null}
        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor={`${uid}-password`}>Contraseña nueva</FieldLabel>
          <Input
            id={`${uid}-password`}
            type="password"
            autoComplete="new-password"
            className="h-10"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          <FieldDescription>Mínimo {PASSWORD_MIN} caracteres.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
        <Field data-invalid={Boolean(errors.confirmar)}>
          <FieldLabel htmlFor={`${uid}-confirmar`}>
            Repite la contraseña
          </FieldLabel>
          <Input
            id={`${uid}-confirmar`}
            type="password"
            autoComplete="new-password"
            className="h-10"
            aria-invalid={Boolean(errors.confirmar)}
            {...register("confirmar")}
          />
          <FieldError errors={[errors.confirmar]} />
        </Field>
        <Button
          type="submit"
          className="h-10 sm:self-end"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </FieldGroup>
    </form>
  );
}
