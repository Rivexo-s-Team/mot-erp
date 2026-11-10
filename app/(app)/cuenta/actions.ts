"use server";

import {
  cambiarPasswordSchema,
  type ActionResult,
  type CambiarPasswordInput,
} from "@/lib/auth/schemas";
import { requireSesion } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function cambiarPassword(
  input: CambiarPasswordInput,
): Promise<ActionResult | { ok: true }> {
  await requireSesion();
  const parsed = cambiarPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa la contraseña." };

  // Con la sesión del propio usuario: solo puede cambiar la suya.
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "La contraseña nueva debe ser distinta a la actual."
          : "No se pudo cambiar la contraseña. Intenta de nuevo.",
    };
  }
  return { ok: true };
}
