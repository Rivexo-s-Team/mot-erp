import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireSesion, tienePermiso } from "@/lib/auth/session";
import { getCatalogo, valoresIniciales } from "@/lib/catalogos/config";
import { redirect } from "next/navigation";
import { CatalogoForm } from "../../catalogo-form";

export default async function NuevoEnCatalogoPage({
  params,
}: PageProps<"/catalogos/[catalogo]/nuevo">) {
  const sesion = await requireSesion();
  const catalogo = getCatalogo((await params).catalogo);
  if (!catalogo) notFound();
  if (!tienePermiso(sesion, catalogo.permisoEditar))
    redirect(`/catalogos/${catalogo.slug}`);

  return (
    <div className="mx-auto max-w-xl">
      <title>{`Agregar ${catalogo.singular} · Sistema MOT`}</title>
      <PageHeader
        title={`Agregar ${catalogo.singular}`}
        description={catalogo.titulo}
      />
      <Card>
        <CardContent>
          <CatalogoForm
            slug={catalogo.slug}
            id={null}
            valores={valoresIniciales(catalogo)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
