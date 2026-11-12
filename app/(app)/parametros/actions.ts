"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { esquemaCampos, type Valores } from "@/lib/forms/campos";
import { CAMPOS_PARAMETRO } from "@/lib/parametros/campos";
import { createClient } from "@/lib/supabase/server";

export async function guardarParametro(
  clave: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("parametros.editar");
  if (!/^[a-z][a-z0-9_]*$/.test(clave))
    return { error: "Parámetro no válido." };
  const parsed = esquemaCampos(CAMPOS_PARAMETRO).safeParse(valores);
  if (!parsed.success) return { error: "Escribe un número válido." };

  const valor = Number(parsed.data.valor);
  const supabase = await createClient();
  const { data: actual } = await supabase
    .from("parametros_negocio")
    .select("unidad")
    .eq("clave", clave)
    .maybeSingle();
  if (!actual) return { error: "El parámetro no existe." };
  if (actual.unidad === "fraccion" && (valor <= 0 || valor > 1)) {
    return {
      error: "El porcentaje va como fracción entre 0 y 1 (0.70 es 70 %).",
    };
  }
  if (
    ["pruebas_no_pasa", "dias"].includes(actual.unidad) &&
    !Number.isInteger(valor)
  ) {
    return { error: "Debe ser un número entero." };
  }
  if (valor <= 0) return { error: "El valor debe ser mayor que cero." };

  // Con la sesión del usuario: RLS exige parametros.editar y la bitácora anota quién lo cambió.
  const { data, error } = await supabase
    .from("parametros_negocio")
    .update({ valor })
    .eq("clave", clave)
    .select("id");
  if (error || data.length === 0)
    return { error: "Tu rol no puede cambiar este parámetro." };

  revalidatePath("/parametros");
  redirect("/parametros");
}
