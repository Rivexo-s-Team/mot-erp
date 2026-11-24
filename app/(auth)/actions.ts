"use server";

import { redirect } from "next/navigation";
import {
  cambiarPasswordSchema,
  loginSchema,
  recuperarSchema,
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

/**
 * Manda el correo para restablecer la contraseña. Responde igual exista o no
 * el usuario, para no revelar qué correos tienen cuenta.
 */
export async function pedirRecuperacion(formulario: FormData): Promise<void> {
  const parsed = recuperarSchema.safeParse({
    correo: String(formulario.get("correo") ?? ""),
  });
  if (!parsed.success) redirect("/recuperar?error=correo");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.correo,
  );
  if (error?.status === 429) redirect("/recuperar?error=espera");
  redirect("/recuperar?enviado=1");
}

/**
 * Guarda la contraseña nueva. Llega con el código del correo (de un solo uso:
 * se gasta aquí, no al abrir el enlace, para que no lo consuma un antivirus
 * que revisa los enlaces) o, si ese paso ya pasó, con la sesión abierta.
 */
export async function restablecerPassword(formulario: FormData): Promise<void> {
  const token = String(formulario.get("token_hash") ?? "");
  const regreso = (motivo: string, conToken: boolean) =>
    `/restablecer?error=${motivo}${conToken && token ? `&token_hash=${encodeURIComponent(token)}` : ""}`;

  const parsed = cambiarPasswordSchema.safeParse({
    password: String(formulario.get("password") ?? ""),
    confirmar: String(formulario.get("confirmar") ?? ""),
  });
  if (!parsed.success) redirect(regreso("password", true));

  const supabase = await createClient();
  if (token) {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: token,
    });
    if (error) redirect("/recuperar?error=enlace");
  } else {
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/recuperar?error=enlace");
  }

  // Desde aquí ya hay sesión: si algo falla, se reintenta sin el código.
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    redirect(
      regreso(error.code === "same_password" ? "igual" : "fallo", false),
    );
  redirect("/");
}
