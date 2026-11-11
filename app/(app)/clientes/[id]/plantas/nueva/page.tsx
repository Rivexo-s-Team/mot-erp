import { RegistroPage } from "../../registro-page";

export default async function Page({
  params,
}: PageProps<"/clientes/[id]/plantas/nueva">) {
  const { id } = await params;
  return <RegistroPage entidad="plantas" cuentaId={id} registro="nueva" />;
}
