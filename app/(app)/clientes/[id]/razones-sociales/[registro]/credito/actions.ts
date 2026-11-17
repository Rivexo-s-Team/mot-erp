"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { camposCredito, validarCredito } from "@/lib/facturacion/credito";
import { razonSocialParaCredito } from "@/lib/facturacion/data";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { createClient } from "@/lib/supabase/server";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** Guarda las condiciones de crédito de una razón social (las crea o las corrige). */
export async function guardarCredito(
  cuentaId: string,
  razonId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(cuentaId) || !esId(razonId))
    return { error: "Registro no válido." };
  const razon = await razonSocialParaCredito(cuentaId, razonId);
  if (!razon) return { error: "La razón social ya no existe." };

  const campos = camposCredito(razon.contactos);
  const parsed = esquemaCampos(campos, validarCredito).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from("condiciones_credito")
    .upsert(
      {
        ...aFila(campos, parsed.data, false),
        razon_social_id: razonId,
        cuenta_id: cuentaId,
      },
      { onConflict: "razon_social_id" },
    )
    .select("razon_social_id");
  if (error || !data?.[0])
    return {
      error:
        error?.code === "23514"
          ? "Revisa los días de crédito y la forma de pago."
          : error?.code === "23503"
            ? "El contacto no es de este cliente."
            : !error || error.code === "42501"
              ? "Tu rol no puede capturar condiciones de crédito."
              : "No se pudo guardar. Intenta de nuevo.",
    };

  revalidatePath(`/clientes/${cuentaId}`);
  redirect(`/clientes/${cuentaId}`);
}
