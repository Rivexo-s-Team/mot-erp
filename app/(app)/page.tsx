import { BrandScreen } from "@/components/brand/brand-screen";

export default function InicioPage() {
  return (
    <BrandScreen
      title="Sistema MOT"
      description="Plataforma de operación de Molecular Oil Technology: clientes, flota Robox, servicio en campo, laboratorio y facturación."
    >
      <p className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
        <span className="size-1.5 rounded-full bg-marca-verde" aria-hidden />
        En construcción · Etapa 0: cimientos
      </p>
    </BrandScreen>
  );
}
