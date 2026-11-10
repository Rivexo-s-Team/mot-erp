import type { Metadata } from "next";
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
    </BrandScreen>
  );
}
