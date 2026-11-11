import { RegistroPage } from "../../../registro-page";

export default async function Page({
  params,
}: PageProps<"/clientes/[id]/plantas/[planta]/editar">) {
  const { id, planta } = await params;
  return <RegistroPage entidad="plantas" cuentaId={id} registro={planta} />;
}
