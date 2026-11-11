"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import {
  CAMPOS_ETAPA,
  camposActividad,
  camposOportunidad,
  validarEtapa,
} from "@/lib/pipeline/campos";
import { directorioComercial } from "@/lib/pipeline/data";
import { createClient } from "@/lib/supabase/server";

const PERMISO = "oportunidades.editar";
const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** Las tablas se nombran aquí, nunca con datos del usuario; RLS decide el acceso. */
async function tabla(nombre: "oportunidades" | "actividades_comerciales") {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from(nombre);
}

function mensajeError(code: string | undefined): string {
  if (code === "23503")
    return "Uno de los datos elegidos no pertenece a esta cuenta.";
  if (code === "42501") return "Tu rol no puede hacer este cambio.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

/** El responsable debe ser alguien interno que pueda llevar oportunidades. */
async function esResponsableValido(id: unknown): Promise<boolean> {
  const { asignables } = await directorioComercial();
  return asignables.some((r) => r.value === id);
}

/** Crea (id = null, con su cuenta) o edita una oportunidad. */
export async function guardarOportunidad(
  cuentaId: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(cuentaId) || (id !== null && !esId(id)))
    return { error: "Registro no válido." };

  const campos = camposOportunidad([], [], []);
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  if (!(await esResponsableValido(parsed.data.responsable_id))) {
    return {
      error:
        "El responsable debe ser una persona de Dirección o Comercial activa.",
    };
  }

  const fila = aFila(campos, parsed.data, id !== null);
  const t = await tabla("oportunidades");
  const { data, error } = id
    ? await t.update(fila).eq("id", id).eq("cuenta_id", cuentaId).select("id")
    : await t.insert({ ...fila, cuenta_id: cuentaId }).select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  const destino = `/oportunidades/${(data[0] as { id: string }).id}`;
  revalidatePath("/oportunidades");
  revalidatePath(destino);
  redirect(destino);
}

export async function cambiarEtapa(
  id: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(id)) return { error: "Registro no válido." };
  const parsed = esquemaCampos(CAMPOS_ETAPA, validarEtapa).safeParse(valores);
  if (!parsed.success)
    return { error: "Si la marcas como perdida, escribe el motivo." };

  const { etapa, motivo_perdida } = parsed.data;
  const { data, error } = await (
    await tabla("oportunidades")
  )
    .update({
      etapa,
      motivo_perdida: etapa === "perdida" ? motivo_perdida : null,
    })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath("/oportunidades");
  revalidatePath(`/oportunidades/${id}`);
  redirect(`/oportunidades/${id}`);
}

export async function eliminarOportunidad(id: string): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(id)) return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla("oportunidades")
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath("/oportunidades");
  redirect("/oportunidades");
}

export async function guardarActividad(
  oportunidadId: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(oportunidadId) || (id !== null && !esId(id)))
    return { error: "Registro no válido." };

  const campos = camposActividad([], "", "");
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const { nombres } = await directorioComercial();
  if (!nombres.has(String(parsed.data.responsable_id))) {
    return { error: "Elige quién hizo la actividad." };
  }

  const fila = aFila(campos, parsed.data, id !== null);
  const t = await tabla("actividades_comerciales");
  const { data, error } = id
    ? await t
        .update(fila)
        .eq("id", id)
        .eq("oportunidad_id", oportunidadId)
        .select("id")
    : await t.insert({ ...fila, oportunidad_id: oportunidadId }).select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath(`/oportunidades/${oportunidadId}`);
  redirect(`/oportunidades/${oportunidadId}`);
}

export async function eliminarActividad(
  oportunidadId: string,
  id: string,
): Promise<ActionResult> {
  await requirePermiso(PERMISO);
  if (!esId(oportunidadId) || !esId(id))
    return { error: "Registro no válido." };
  const { data, error } = await (
    await tabla("actividades_comerciales")
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("oportunidad_id", oportunidadId)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501") };

  revalidatePath(`/oportunidades/${oportunidadId}`);
  redirect(`/oportunidades/${oportunidadId}`);
}
