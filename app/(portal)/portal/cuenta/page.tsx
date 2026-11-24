import type { Metadata } from "next";
import Link from "next/link";
import { PasswordForm } from "@/app/(app)/cuenta/password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSesionPortal } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function CuentaPortalPage() {
  const sesion = await requireSesionPortal();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/portal"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Portal
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
      <Card>
        <CardHeader>
          <CardTitle>{sesion.nombre}</CardTitle>
          <CardDescription>{sesion.correo}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <span className="text-muted-foreground">Empresa: </span>
            {sesion.cuenta.nombre}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Para cambiar tus datos o dar acceso a otra persona, pídelo a tu
            contacto en MOT.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
