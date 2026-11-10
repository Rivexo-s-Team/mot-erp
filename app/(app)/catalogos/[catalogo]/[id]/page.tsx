import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireSesion, tienePermiso } from "@/lib/auth/session";
import { getCatalogo, valoresIniciales } from "@/lib/catalogos/config";
import { obtenerDeCatalogo } from "@/lib/catalogos/data";
import { CatalogoForm } from "../../catalogo-form";

export default async function EditarEnCatalogoPage({
  params,
}: PageProps<"/catalogos/[catalogo]/[id]">) {
  const sesion = await requireSesion();
  const { catalogo: slug, id } = await params;
  const catalogo = getCatalogo(slug);
  if (!catalogo || !z.uuid().safeParse(id).success) notFound();
  if (!tienePermiso(sesion, catalogo.permisoEditar))
    redirect(`/catalogos/${catalogo.slug}`);

  const fila = await obtenerDeCatalogo(catalogo, id);
  if (!fila) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <title>{`Editar ${catalogo.singular} · Sistema MOT`}</title>
      <PageHeader
        title={`Editar ${catalogo.singular}`}
        description={catalogo.nombre(fila)}
      />
      <Card>
        <CardContent>
          <CatalogoForm
            slug={catalogo.slug}
            id={id}
            valores={valoresIniciales(catalogo, fila)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
