import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { pedirRecuperacion } from "@/app/(auth)/actions";
import { BrandScreen } from "@/components/brand/brand-screen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MENSAJES_RECUPERACION } from "@/lib/auth/schemas";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage(props: PageProps<"/recuperar">) {
  return (
    <BrandScreen
      title="Recuperar contraseña"
      description="Escribe el correo con el que entras. Te mandamos un enlace para elegir una contraseña nueva."
    >
      <Suspense>
        <Contenido {...props} />
      </Suspense>
    </BrandScreen>
  );
}

async function Contenido({ searchParams }: PageProps<"/recuperar">) {
  const { enviado, error } = await searchParams;
  const motivo =
    typeof error === "string" ? MENSAJES_RECUPERACION[error] : undefined;

  if (enviado)
    return (
      <div className="space-y-4 text-left text-sm">
        <Alert>
          <AlertDescription>
            Si ese correo tiene una cuenta, en unos minutos llegará un mensaje
            con el enlace. Revisa también la carpeta de correo no deseado.
          </AlertDescription>
        </Alert>
        <Link
          href="/login"
          className="block text-center text-primary underline-offset-4 hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    );

  return (
    <form action={pedirRecuperacion} className="space-y-4 text-left">
      {motivo ? (
        <Alert variant="destructive">
          <AlertDescription>{motivo}</AlertDescription>
        </Alert>
      ) : null}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Correo
        <Input
          name="correo"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          className="h-10 font-normal"
        />
      </label>
      <Button type="submit" className="h-10 w-full">
        Mandar enlace
      </Button>
      <Link
        href="/login"
        className="block text-center text-sm text-primary underline-offset-4 hover:underline"
      >
        Volver a iniciar sesión
      </Link>
    </form>
  );
}
