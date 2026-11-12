import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import { camposContrato } from "@/lib/contratos/campos";
import {
  contratosParaOrigen,
  nombreContrato,
  obtenerContrato,
  razonesSocialesDeCuenta,
} from "@/lib/contratos/data";
import { valoresIniciales } from "@/lib/forms/campos";
import { plantasDeCuenta } from "@/lib/pipeline/data";
import { ContratoForm } from "../../contrato-form";

export const metadata: Metadata = { title: "Editar contrato" };

export default async function EditarContratoPage({
  params,
}: PageProps<"/contratos/[id]/editar">) {
  await requirePermiso("contratos.editar");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const c = await obtenerContrato(id);
  if (!c) notFound();

  const [plantas, razones, origenes] = await Promise.all([
    plantasDeCuenta(c.cuenta_id),
    razonesSocialesDeCuenta(c.cuenta_id),
    contratosParaOrigen(c.cuenta_id, c.id),
  ]);
  // La planta ya no cambia, pero se muestra aunque se haya dado de baja.
  if (!plantas.some((p) => p.value === c.planta_id))
    plantas.push({ value: c.planta_id, label: c.plantas?.nombre ?? "—" });
  const campos = camposContrato(plantas, razones, origenes);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Editar contrato"
        description={`${c.cuentas.nombre} · ${nombreContrato(c)}`}
      />
      <Card>
        <CardContent>
          <ContratoForm
            cuentaId={c.cuenta_id}
            contratoId={c.id}
            oportunidadId={null}
            campos={campos}
            valores={valoresIniciales(campos, {
              planta_id: c.planta_id,
              tipo: c.tipo,
              estado: c.estado,
              razon_social_id: c.razon_social_id,
              referencia: c.referencia,
              contrato_origen_id: c.contrato_origen_id,
              fecha_inicio: c.fecha_inicio,
              fecha_termino: c.fecha_termino,
              moneda: c.moneda,
              incluye_filtros: c.incluye_filtros,
              incluye_laboratorio: c.incluye_laboratorio,
              frecuencia_visitas: c.frecuencia_visitas,
              notas: c.notas,
            })}
            cancelarHref={`/contratos/${c.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
