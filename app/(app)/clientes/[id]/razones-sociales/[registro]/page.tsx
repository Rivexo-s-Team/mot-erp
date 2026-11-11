import { RegistroPage } from "../../registro-page";

export default async function Page({
  params,
}: PageProps<"/clientes/[id]/razones-sociales/[registro]">) {
  const { id, registro } = await params;
  return (
    <RegistroPage
      entidad="razones_sociales"
      cuentaId={id}
      registro={registro}
    />
  );
}
