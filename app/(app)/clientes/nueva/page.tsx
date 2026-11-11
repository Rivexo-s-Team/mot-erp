import type { Metadata } from "next";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { CAMPOS_CUENTA } from "@/lib/clientes/campos";
import { valoresIniciales } from "@/lib/forms/campos";
import { guardarCuenta } from "../actions";

export const metadata: Metadata = { title: "Nueva cuenta" };

export default async function NuevaCuentaPage() {
  await requirePermiso("clientes.editar");

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Nueva cuenta"
        description="El grupo o empresa. Después le agregas plantas, razones sociales y contactos."
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={CAMPOS_CUENTA}
            valores={valoresIniciales(CAMPOS_CUENTA)}
            esEdicion={false}
            guardar={guardarCuenta.bind(null, null)}
            cancelarHref="/clientes"
            textoGuardar="Crear cuenta"
          />
        </CardContent>
      </Card>
    </div>
  );
}
