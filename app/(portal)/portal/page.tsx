import type { Metadata } from "next";
import { Suspense } from "react";
import { cerrarSesion } from "@/app/(auth)/actions";
import { BrandScreen } from "@/components/brand/brand-screen";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSesionPortal } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Portal de clientes" };

export default function PortalPage() {
  return (
    <BrandScreen
      title="Portal de clientes"
      description="Aquí podrás consultar tus informes de laboratorio, órdenes de servicio y facturas. Estará disponible próximamente."
    >
      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <PortalSesion />
      </Suspense>
    </BrandScreen>
  );
}

async function PortalSesion() {
  const sesion = await requireSesionPortal();

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Entraste como <span className="font-medium">{sesion.nombre}</span>.
      </p>
      <form action={cerrarSesion}>
        <Button type="submit" variant="outline" className="h-10 w-full">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
