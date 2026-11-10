"use server";

import { redirect } from "next/navigation";
import {
  loginSchema,
  type ActionResult,
  type LoginInput,
} from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export async function iniciarSesion(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa tu correo y contraseña." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.correo,
    password: parsed.data.password,
  });
  if (error || !data.user) return { error: "Correo o contraseña incorrectos." };

  // Un usuario sin perfil activo no entra, aunque su contraseña sea correcta.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("activo")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!perfil?.activo) {
    await supabase.auth.signOut();
    return { error: "Tu usuario no está activo. Pide acceso a Dirección." };
  }

  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
