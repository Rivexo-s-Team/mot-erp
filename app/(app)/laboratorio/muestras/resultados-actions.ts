"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermiso } from "@/lib/auth/session";
import { listarParametrosLab, obtenerMuestra } from "@/lib/laboratorio/data";
import { accionesMuestra } from "@/lib/laboratorio/muestras";
import { prepararResultados } from "@/lib/laboratorio/resultados";
import { createClient } from "@/lib/supabase/server";

export type ResultadoGuardar =
  { error: string; errores?: Record<string, string> } | undefined;

const esquema = z.record(z.uuid(), z.string().max(200));

/** Guarda de una vez todos los resultados de una muestra (reemplaza los anteriores). */
export async function guardarResultados(
  muestraId: string,
  valores: Record<string, string>,
): Promise<ResultadoGuardar> {
  await requirePermiso("laboratorio.editar");
  const parsed = esquema.safeParse(valores);
  if (!z.uuid().safeParse(muestraId).success || !parsed.success)
    return { error: "Registro no válido." };

  const muestra = await obtenerMuestra(muestraId);
  if (!muestra) return { error: "La muestra ya no existe." };
  if (!accionesMuestra(muestra.estado).capturar)
    return { error: "La muestra está cancelada: no lleva resultados." };

  const preparado = prepararResultados(
    parsed.data,
    await listarParametrosLab(),
  );
  if (!preparado.ok)
    return {
      error: "Revisa los valores marcados.",
      errores: preparado.errores,
    };

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_resultados_muestra", {
    p_muestra: muestraId,
    p_resultados: preparado.resultados,
  });
  if (error)
    return {
      error:
        error.code === "42501"
          ? "Tu rol no puede capturar resultados."
          : error.code === "P0001"
            ? error.message
            : "No se pudo guardar. Intenta de nuevo.",
    };

  revalidatePath(`/laboratorio/muestras/${muestraId}`);
  redirect(`/laboratorio/muestras/${muestraId}`);
}
