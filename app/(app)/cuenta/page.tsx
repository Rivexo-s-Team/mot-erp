import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSesion } from "@/lib/auth/session";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function CuentaPage() {
  const sesion = await requireSesion();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Mi cuenta" />
      <Card>
        <CardHeader>
          <CardTitle>{sesion.nombre}</CardTitle>
          <CardDescription>{sesion.correo}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Rol</dt>
            <dd>{sesion.rol.nombre}</dd>
            <dt className="text-muted-foreground">Puesto</dt>
            <dd>{sesion.puesto ?? "—"}</dd>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">
            Para cambiar tu nombre, puesto o rol, pídelo a Dirección.
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
