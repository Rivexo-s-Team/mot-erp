import { RegistroPage } from "../../registro-page";

export default async function Page({
  params,
}: PageProps<"/clientes/[id]/contactos/[registro]">) {
  const { id, registro } = await params;
  return <RegistroPage entidad="contactos" cuentaId={id} registro={registro} />;
}
