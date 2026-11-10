import type { Metadata } from "next";
import { BrandScreen } from "@/components/brand/brand-screen";

export const metadata: Metadata = { title: "Portal de clientes" };

export default function PortalPage() {
  return (
    <BrandScreen
      title="Portal de clientes"
      description="Informes de laboratorio, órdenes de servicio y facturas de cada cliente. Disponible en la Etapa 6."
    />
  );
}
