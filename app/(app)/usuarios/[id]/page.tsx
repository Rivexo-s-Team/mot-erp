import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { UsuarioForm } from "../usuario-form";

export const metadata: Metadata = { title: "Editar usuario" };

export default async function EditarUsuarioPage({
  params,
}: PageProps<"/usuarios/[id]">) {
  const sesion = await requirePermiso("usuarios.administrar");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const supabase = await createClient();
  const [{ data: usuario }, { data: roles }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombre, correo, puesto, rol_id, activo")
      .eq("id", id.data)
      .maybeSingle(),
    supabase.from("roles").select("id, nombre").order("nombre"),
  ]);
  if (!usuario) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Editar usuario" description={usuario.correo} />
      {usuario.id === sesion.id ? (
        <Alert className="mb-4">
          <AlertDescription>
            Este es tu propio usuario: no puedes cambiar tu rol ni desactivarte.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <UsuarioForm
            roles={roles ?? []}
            usuario={{
              id: usuario.id,
              nombre: usuario.nombre,
              correo: usuario.correo,
              puesto: usuario.puesto,
              rolId: usuario.rol_id,
              activo: usuario.activo,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
