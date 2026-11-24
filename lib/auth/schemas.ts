import { z } from "zod";

export const PASSWORD_MIN = 10;

const correo = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Escribe un correo válido."));

const password = z
  .string()
  .min(
    PASSWORD_MIN,
    `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  )
  .max(72, "La contraseña no puede pasar de 72 caracteres.");

export const loginSchema = z.object({
  correo,
  password: z.string().min(1, "Escribe tu contraseña."),
});
export type LoginInput = z.input<typeof loginSchema>;

const datosUsuario = {
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre completo.")
    .max(120, "Máximo 120 caracteres."),
  puesto: z.string().trim().max(120, "Máximo 120 caracteres."),
  rolId: z.uuid("Elige un rol."),
};

export const crearUsuarioSchema = z.object({
  ...datosUsuario,
  correo,
  password,
});
export type CrearUsuarioInput = z.input<typeof crearUsuarioSchema>;

export const editarUsuarioSchema = z.object({
  id: z.uuid(),
  ...datosUsuario,
  activo: z.boolean(),
  // Vacío = no cambiar la contraseña.
  password: z.union([z.literal(""), password]),
});
export type EditarUsuarioInput = z.input<typeof editarUsuarioSchema>;

/** Esquema del formulario de usuario (alta o edición) en el navegador. */
export function usuarioFormSchema(esEdicion: boolean) {
  return z.object({
    ...datosUsuario,
    correo,
    activo: z.boolean(),
    password: esEdicion ? editarUsuarioSchema.shape.password : password,
  });
}
export type UsuarioFormValues = z.infer<ReturnType<typeof usuarioFormSchema>>;

export const cambiarPasswordSchema = z
  .object({ password, confirmar: z.string() })
  .refine((v) => v.password === v.confirmar, {
    path: ["confirmar"],
    message: "Las contraseñas no coinciden.",
  });
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;

/** Pedir el correo de recuperación de contraseña. */
export const recuperarSchema = z.object({ correo });

/** Motivos por los que no se pudo recuperar o restablecer, para explicarlos en pantalla. */
export const MENSAJES_RECUPERACION: Record<string, string> = {
  correo: "Escribe un correo válido.",
  espera:
    "Ya se pidió un correo hace un momento. Espera unos minutos e intenta de nuevo.",
  enlace:
    "El enlace ya se usó o venció. Pide uno nuevo; sirve una sola vez y dura una hora.",
  password: `Las dos contraseñas deben ser iguales y tener al menos ${PASSWORD_MIN} caracteres.`,
  igual: "La contraseña nueva debe ser distinta a la anterior.",
  fallo: "No se pudo cambiar la contraseña. Intenta de nuevo.",
};

/** Resultado de una acción de formulario. */
export type ActionResult = { error: string } | undefined;
