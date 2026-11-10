import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSesion } from "@/lib/auth/session";

export default async function InicioPage() {
  const sesion = await requireSesion();
  const primerNombre = sesion.nombre.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Hola, ${primerNombre}`}
        description="Sistema de operación de Molecular Oil Technology."
      />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Tu acceso</CardTitle>
          <CardDescription>
            Entraste como{" "}
            <span className="font-medium text-foreground">
              {sesion.rol.nombre}
            </span>
            {sesion.puesto ? ` · ${sesion.puesto}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          El sistema está en construcción (Etapa 0: cimientos). Los módulos
          aparecerán aquí conforme se vayan liberando, según los permisos de tu
          rol.
        </CardContent>
      </Card>
    </>
  );
}
