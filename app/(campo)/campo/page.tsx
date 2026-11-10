import type { Metadata } from "next";
import { BrandScreen } from "@/components/brand/brand-screen";

export const metadata: Metadata = { title: "Campo" };

export default function CampoPage() {
  return (
    <BrandScreen
      title="Campo"
      description="Captura de órdenes de servicio desde el celular. Disponible en la Etapa 3."
    />
  );
}
