import type { Metadata } from "next";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { CAMPOS_ROBOX } from "@/lib/flota/campos";
import { valoresIniciales } from "@/lib/forms/campos";
import { guardarRobox } from "../actions";

export const metadata: Metadata = { title: "Nuevo Robox" };

export default async function NuevoRoboxPage() {
  await requirePermiso("flota.editar");

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Nuevo Robox"
        description="Da de alta un equipo en la flota de MOT."
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={CAMPOS_ROBOX}
            valores={valoresIniciales(CAMPOS_ROBOX)}
            esEdicion={false}
            guardar={guardarRobox.bind(null, null)}
            cancelarHref="/flota"
            textoGuardar="Agregar Robox"
          />
        </CardContent>
      </Card>
    </div>
  );
}
