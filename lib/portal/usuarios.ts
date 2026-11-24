import { z } from "zod";
import { PASSWORD_MIN } from "@/lib/auth/schemas";

/** Alta de un usuario del portal de clientes (persona del cliente). */
export const usuarioPortalSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  correo: z.string().trim().toLowerCase().pipe(z.email()),
  puesto: z.string().trim().max(120),
  password: z.string().min(PASSWORD_MIN).max(72),
});
export type UsuarioPortalInput = z.infer<typeof usuarioPortalSchema>;

export type LecturaUsuarioPortal =
  | { ok: true; datos: UsuarioPortalInput }
  | { ok: false; error: keyof typeof MENSAJES_USUARIO_PORTAL };

/** Motivos por los que no procede el alta, para explicarlos en pantalla. */
export const MENSAJES_USUARIO_PORTAL = {
  nombre: "Escribe el nombre completo de la persona.",
  correo: "Escribe un correo válido.",
  puesto: "El puesto no puede pasar de 120 caracteres.",
  password: `La contraseña temporal debe tener entre ${PASSWORD_MIN} y 72 caracteres.`,
  existe: "Ya existe un usuario con ese correo.",
  fallo: "No se pudo dar de alta al usuario. Intenta de nuevo.",
} as const;

/** Lee el formulario de alta; dice cuál es el primer campo que no procede. */
export function leerUsuarioPortal(
  campos: Record<string, unknown>,
): LecturaUsuarioPortal {
  const texto = (v: unknown) => (typeof v === "string" ? v : "");
  const leido = usuarioPortalSchema.safeParse({
    nombre: texto(campos.nombre),
    correo: texto(campos.correo),
    puesto: texto(campos.puesto),
    password: texto(campos.password),
  });
  if (leido.success) return { ok: true, datos: leido.data };
  const campo = leido.error.issues[0]?.path[0];
  return {
    ok: false,
    error:
      campo === "correo" || campo === "puesto" || campo === "password"
        ? campo
        : "nombre",
  };
}
