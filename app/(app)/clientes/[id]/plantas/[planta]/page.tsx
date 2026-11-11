import { RegistroPage } from "../../registro-page";

export default async function Page({
  params,
}: PageProps<"/clientes/[id]/plantas/[registro]">) {
  const { id, registro } = await params;
  return <RegistroPage entidad="plantas" cuentaId={id} registro={registro} />;
}
