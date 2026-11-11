import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { CAMPOS_CUENTA } from "@/lib/clientes/campos";
import { obtenerCuenta } from "@/lib/clientes/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { eliminarCuenta, guardarCuenta } from "../../actions";

export const metadata: Metadata = { title: "Editar cuenta" };

export default async function EditarCuentaPage({
  params,
}: PageProps<"/clientes/[id]/editar">) {
  await requirePermiso("clientes.editar");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const cuenta = await obtenerCuenta(id);
  if (!cuenta) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Editar cuenta" description={cuenta.nombre} />
      <Card>
        <CardContent>
          <ConfigForm
            campos={CAMPOS_CUENTA}
            valores={valoresIniciales(CAMPOS_CUENTA, {
              nombre: cuenta.nombre,
              tipo_industria: cuenta.tipo_industria,
              notas: cuenta.notas,
            })}
            esEdicion
            guardar={guardarCuenta.bind(null, id)}
            cancelarHref={`/clientes/${id}`}
            textoGuardar="Guardar cambios"
            eliminar={eliminarCuenta.bind(null, id)}
            confirmarEliminar={`¿Eliminar la cuenta ${cuenta.nombre}? Dejará de aparecer en Clientes.`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
