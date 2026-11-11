import { RegistroPlantaPage } from "../../registro-planta-page";

export default async function Page({
  params,
}: PageProps<"/clientes/[id]/plantas/[planta]/equipos/[registro]">) {
  const { id, planta, registro } = await params;
  return (
    <RegistroPlantaPage
      entidad="equipos_cliente"
      cuentaId={id}
      plantaId={planta}
      registro={registro}
    />
  );
}
