import type { Metadata } from "next";
import { Suspense } from "react";
import { restablecerPassword } from "@/app/(auth)/actions";
import { BrandScreen } from "@/components/brand/brand-screen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MENSAJES_RECUPERACION, PASSWORD_MIN } from "@/lib/auth/schemas";

export const metadata: Metadata = { title: "Contraseña nueva" };

export default function RestablecerPage(props: PageProps<"/restablecer">) {
  return (
    <BrandScreen
      title="Elige una contraseña nueva"
      description={`Debe tener al menos ${PASSWORD_MIN} caracteres. Al guardarla entras al sistema.`}
    >
      <Suspense>
        <Contenido {...props} />
      </Suspense>
    </BrandScreen>
  );
}

async function Contenido({ searchParams }: PageProps<"/restablecer">) {
  const { token_hash, error } = await searchParams;
  const motivo =
    typeof error === "string" ? MENSAJES_RECUPERACION[error] : undefined;

  return (
    <form action={restablecerPassword} className="space-y-4 text-left">
      {motivo ? (
        <Alert variant="destructive">
          <AlertDescription>{motivo}</AlertDescription>
        </Alert>
      ) : null}
      {typeof token_hash === "string" ? (
        <input type="hidden" name="token_hash" value={token_hash} />
      ) : null}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Contraseña nueva
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          className="h-10 font-normal"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Repítela
        <Input
          name="confirmar"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          className="h-10 font-normal"
        />
      </label>
      <Button type="submit" className="h-10 w-full">
        Guardar y entrar
      </Button>
    </form>
  );
}
