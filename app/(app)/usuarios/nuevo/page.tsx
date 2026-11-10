import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { UsuarioForm } from "../usuario-form";

export const metadata: Metadata = { title: "Nuevo usuario" };

export default async function NuevoUsuarioPage() {
  await requirePermiso("usuarios.administrar");
  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("roles")
    .select("id, nombre")
    .order("nombre");

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Nuevo usuario"
        description="Dale acceso a una persona y asígnale un rol."
      />
      <Card>
        <CardContent>
          <UsuarioForm roles={roles ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
