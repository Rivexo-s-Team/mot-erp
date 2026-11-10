import type { Metadata } from "next";

export const metadata: Metadata = { title: "Campo" };

export default function CampoPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-semibold">Campo</h1>
      <p className="text-muted-foreground">
        Captura de órdenes de servicio desde el celular (Etapa 3).
      </p>
    </main>
  );
}
