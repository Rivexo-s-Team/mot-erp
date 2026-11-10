import { z } from "zod";

// Variables públicas: llegan al navegador. Next.js solo las incluye si se
// leen con su nombre completo, por eso no se recorre process.env.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

function parse<T>(schema: z.ZodType<T>, values: unknown): T {
  const result = schema.safeParse(values);
  if (!result.success) {
    const faltantes = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Variables de entorno faltantes o inválidas: ${faltantes}. Revisa .env.example.`,
    );
  }
  return result.data;
}

export function getPublicEnv() {
  return parse(publicSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

/** Solo en el servidor: la llave secreta salta RLS y nunca debe llegar al navegador. */
export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() solo puede usarse en el servidor.");
  }
  return parse(serverSchema, {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}
