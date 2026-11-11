import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { valoresIniciales } from "@/lib/forms/campos";
import { ayudaValor, CAMPOS_PARAMETRO } from "@/lib/parametros/campos";
import { createClient } from "@/lib/supabase/server";
import { guardarParametro } from "../actions";

export const metadata: Metadata = { title: "Cambiar parámetro" };

export default async function ParametroPage({
  params,
}: PageProps<"/parametros/[clave]">) {
  await requirePermiso("parametros.editar");
  const { clave } = await params;
  if (!/^[a-z][a-z0-9_]*$/.test(clave)) notFound();

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("parametros_negocio")
    .select("clave, valor, unidad, moneda, descripcion")
    .eq("clave", clave)
    .maybeSingle();
  if (!p) notFound();

  const campos = CAMPOS_PARAMETRO.map((c) => ({
    ...c,
    ayuda: ayudaValor(p.unidad, p.moneda),
  }));

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Cambiar parámetro" description={p.descripcion} />
      <Card>
        <CardContent>
          <ConfigForm
            campos={campos}
            valores={valoresIniciales(campos, { valor: p.valor })}
            esEdicion
            guardar={guardarParametro.bind(null, p.clave)}
            cancelarHref="/parametros"
            textoGuardar="Guardar"
          />
        </CardContent>
      </Card>
    </div>
  );
}
