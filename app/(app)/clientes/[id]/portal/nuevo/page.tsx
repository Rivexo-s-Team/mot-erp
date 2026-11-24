import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { obtenerCuenta } from "@/lib/clientes/data";
import { MENSAJES_USUARIO_PORTAL } from "@/lib/portal/usuarios";
import { crearUsuarioPortal } from "../../../portal-actions";

export default async function NuevoUsuarioPortalPage({
  params,
  searchParams,
}: PageProps<"/clientes/[id]/portal/nuevo">) {
  await requirePermiso("usuarios.administrar");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const cuenta = await obtenerCuenta(id);
  if (!cuenta) notFound();
  const { error } = await searchParams;
  const motivo =
    typeof error === "string" && error in MENSAJES_USUARIO_PORTAL
      ? MENSAJES_USUARIO_PORTAL[error as keyof typeof MENSAJES_USUARIO_PORTAL]
      : undefined;
  const etiqueta = "flex flex-col gap-1.5 text-sm font-medium";

  return (
    <div className="mx-auto max-w-xl">
      <title>{`Acceso al portal · ${cuenta.nombre} · Sistema MOT`}</title>
      <PageHeader
        migas={[
          { label: "Clientes", href: "/clientes" },
          { label: cuenta.nombre, href: `/clientes/${cuenta.id}` },
        ]}
        title="Dar acceso al portal"
        description={`La persona entrará al portal de clientes y verá solo lo de ${cuenta.nombre}.`}
      />
      <Card>
        <CardContent>
          <form
            action={crearUsuarioPortal.bind(null, cuenta.id)}
            className="space-y-4"
          >
            {motivo ? (
              <Alert variant="destructive">
                <AlertDescription>{motivo}</AlertDescription>
              </Alert>
            ) : null}
            <label className={etiqueta}>
              Nombre completo
              <Input
                name="nombre"
                required
                minLength={2}
                maxLength={120}
                autoComplete="off"
                className="h-10 font-normal"
              />
            </label>
            <label className={etiqueta}>
              Correo
              <Input
                name="correo"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="off"
                required
                className="h-10 font-normal"
              />
            </label>
            <label className={etiqueta}>
              Puesto (opcional)
              <Input
                name="puesto"
                maxLength={120}
                autoComplete="off"
                className="h-10 font-normal"
              />
            </label>
            <label className={etiqueta}>
              Contraseña temporal
              <Input
                name="password"
                type="text"
                required
                minLength={PASSWORD_MIN}
                maxLength={72}
                autoComplete="off"
                className="h-10 font-mono font-normal"
              />
              <span className="font-normal text-muted-foreground">
                Mínimo {PASSWORD_MIN} caracteres. Compártela con la persona;
                podrá cambiarla al entrar o con «¿Olvidaste tu contraseña?».
              </span>
            </label>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link
                href={`/clientes/${cuenta.id}`}
                className={buttonVariants({
                  variant: "outline",
                  className: "h-10",
                })}
              >
                Cancelar
              </Link>
              <Button type="submit" className="h-10">
                Dar acceso
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
