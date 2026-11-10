import type { Metadata } from "next";
import { cerrarSesion } from "@/app/(auth)/actions";
import { BrandScreen } from "@/components/brand/brand-screen";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sin acceso" };

export default function SinAccesoPage() {
  return (
    <BrandScreen
      title="Tu usuario no tiene acceso"
      description="Tu cuenta no está activa en el sistema. Pide a Dirección que la active."
    >
      <form action={cerrarSesion}>
        <Button type="submit" variant="outline" className="h-10 w-full">
          Cerrar sesión
        </Button>
      </form>
    </BrandScreen>
  );
}
