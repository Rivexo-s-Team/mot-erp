import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import {
  filtrosDeRobox,
  filtrosParaElegir,
  obtenerRobox,
} from "@/lib/flota/data";
import { camposFiltro } from "@/lib/flota/filtros";
import { valoresIniciales } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { FiltroForm } from "../../../filtro-form";

export default async function FiltroPage({
  params,
}: PageProps<"/flota/[id]/filtros/[registro]">) {
  await requirePermiso("flota.editar");
  const { id, registro } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const robox = await obtenerRobox(id);
  if (!robox) notFound();

  const esNuevo = registro === "nuevo";
  const [historial, catalogo] = await Promise.all([
    filtrosDeRobox(robox.id),
    filtrosParaElegir(),
  ]);
  const actual = esNuevo ? undefined : historial.find((f) => f.id === registro);
  if (!esNuevo && !actual) notFound();

  // Al registrar solo se ofrecen los filtros que el Robox no tiene instalados.
  const instalados = new Set(
    historial.filter((f) => f.fecha_retiro === null).map((f) => f.parte_id),
  );
  const opciones = actual
    ? [{ value: actual.parte_id, label: actual.partes?.nombre ?? "—" }]
    : catalogo.filter((f) => !instalados.has(f.value));
  const campos = camposFiltro(opciones, hoyEnMexico(), !esNuevo);
  const titulo = esNuevo ? "Registrar filtro instalado" : "Editar filtro";

  return (
    <div className="mx-auto max-w-xl">
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader title={titulo} description={`Robox ${robox.numero_serie}`} />
      <Card>
        <CardContent>
          <FiltroForm
            roboxId={robox.id}
            filtroId={actual?.id ?? null}
            campos={campos}
            valores={valoresIniciales(
              campos,
              actual && {
                parte_id: actual.parte_id,
                fecha_instalacion: actual.fecha_instalacion,
                fecha_retiro: actual.fecha_retiro,
                notas: actual.notas,
              },
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
