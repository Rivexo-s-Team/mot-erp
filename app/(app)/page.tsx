import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSesion } from "@/lib/auth/session";
import { menuPara } from "@/lib/navegacion";

const DESCRIPCIONES: Record<string, string> = {
  "/clientes": "Cuentas, plantas, razones sociales y contactos.",
  "/oportunidades": "Ventas en curso por etapa, con sus actividades.",
  "/flota": "Los Robox de MOT: número de serie, estado y datos del equipo.",
  "/catalogos":
    "Aceites, parámetros de laboratorio, partes, actividades y fallas.",
  "/parametros":
    "Porcentaje y precio mínimo del cotizador, y umbrales de laboratorio.",
  "/usuarios": "Quién entra al sistema y con qué rol.",
};

export default async function InicioPage() {
  const sesion = await requireSesion();
  const primerNombre = sesion.nombre.split(" ")[0];
  const accesos = menuPara(sesion.permisos)
    .flatMap((g) => g.entradas)
    .filter((e) => e.href !== "/");

  return (
    <>
      <PageHeader
        title={`Hola, ${primerNombre}`}
        description={`Entraste como ${sesion.rol.nombre}${sesion.puesto ? ` · ${sesion.puesto}` : ""}.`}
      />

      {accesos.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accesos.map((e) => (
            <li key={e.href}>
              <Link href={e.href} className="block h-full">
                <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <CardHeader>
                    <CardTitle>{e.label}</CardTitle>
                    <CardDescription>{DESCRIPCIONES[e.href]}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-6 text-sm text-muted-foreground">
        El sistema está en construcción. Los módulos aparecerán aquí y en el
        menú conforme se liberen, según los permisos de tu rol.
      </p>
    </>
  );
}
