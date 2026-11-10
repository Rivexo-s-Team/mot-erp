import type { Metadata } from "next";

export const metadata: Metadata = { title: "Portal de clientes" };

export default function PortalPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-semibold">Portal de clientes</h1>
      <p className="text-muted-foreground">Disponible en la Etapa 6.</p>
    </main>
  );
}
