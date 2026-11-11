import { RegistroPlantaPage } from "../../registro-planta-page";

export default async function Page({
  params,
}: PageProps<"/clientes/[id]/plantas/[planta]/requisitos/[registro]">) {
  const { id, planta, registro } = await params;
  return (
    <RegistroPlantaPage
      entidad="requisitos_planta"
      cuentaId={id}
      plantaId={planta}
      registro={registro}
    />
  );
}
