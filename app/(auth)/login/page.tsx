import type { Metadata } from "next";
import Link from "next/link";
import { BrandScreen } from "@/components/brand/brand-screen";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <BrandScreen
      title="Sistema MOT"
      description="Inicia sesión con tu correo y contraseña."
    >
      <LoginForm />
      <Link
        href="/recuperar"
        className="mt-4 block text-sm text-primary underline-offset-4 hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </BrandScreen>
  );
}
