import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermiso } from "@/lib/auth/session";
import { describirLimite } from "@/lib/catalogos/config";
import { nombreEquipo } from "@/lib/flota/campos";
import {
  listarParametrosLab,
  obtenerMuestra,
  resultadosDeMuestra,
} from "@/lib/laboratorio/data";
import {
  accionesMuestra,
  etiqueta,
  NIVELES_ANALISIS,
} from "@/lib/laboratorio/muestras";
import { gruposDeCaptura, loPideElNivel } from "@/lib/laboratorio/resultados";
import { ResultadosForm } from "./resultados-form";

export const metadata: Metadata = { title: "Capturar resultados" };

export default async function ResultadosPage({
  params,
}: PageProps<"/laboratorio/muestras/[id]/resultados">) {
  await requirePermiso("laboratorio.editar");
  const { id } = await params;
  const m = z.uuid().safeParse(id).success ? await obtenerMuestra(id) : null;
  if (!m) notFound();
  if (!accionesMuestra(m.estado).capturar)
    redirect(`/laboratorio/muestras/${m.id}`);

  const [parametros, valores] = await Promise.all([
    listarParametrosLab(),
    resultadosDeMuestra(m.id),
  ]);
  const grupos = gruposDeCaptura(
    parametros.map((p) => ({
      ...p,
      limite: describirLimite(p),
      fueraDeNivel: !loPideElNivel(p, m.nivel_analisis),
    })),
    new Set(Object.keys(valores)),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Resultados de la muestra ${m.id_muestra}`}
        description={[
          m.cuentas?.nombre,
          m.equipos_cliente ? nombreEquipo(m.equipos_cliente) : null,
          m.nivel_analisis
            ? `análisis ${etiqueta(NIVELES_ANALISIS, m.nivel_analisis)}`
            : "nivel de análisis sin definir",
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <ResultadosForm
        muestraId={m.id}
        grupos={grupos}
        valores={valores}
        cancelarHref={`/laboratorio/muestras/${m.id}`}
      />
    </div>
  );
}
