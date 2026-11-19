import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSesion } from "@/lib/auth/session";
import { formatDia, hoyEnMexico } from "@/lib/format";
import { conteosDeInicio, proximasVisitas } from "@/lib/inicio/data";
import { pendientes } from "@/lib/inicio/pendientes";
import { menuPara } from "@/lib/navegacion";

const DESCRIPCIONES: Record<string, string> = {
  "/clientes": "Cuentas, plantas, razones sociales y contactos.",
  "/oportunidades": "Ventas en curso por etapa, con sus actividades.",
  "/contratos": "Lo negociado con cada planta: tipo, vigencia y tarifas.",
  "/agenda": "Visitas programadas y visitas recurrentes de los contratos.",
  "/ordenes": "Visitas a planta y trabajos de taller.",
  "/campo": "Tus órdenes del día, para capturar desde el celular.",
  "/flota": "Los Robox de MOT: número de serie, estado y datos del equipo.",
  "/inventario":
    "Existencia de partes y accesorios, con sus entradas y salidas.",
  "/documentos-acceso":
    "Documentos de MOT y de su personal para entrar a planta, con su vencimiento.",
  "/laboratorio/muestras":
    "Frascos de aceite, sus resultados y la condición del aceite.",
  "/laboratorio/informes":
    "Informes por equipo con tendencias, validación y PDF.",
  "/cargos": "Rentas, servicios y pagos únicos que falta facturar.",
  "/facturas": "Facturas en borrador, emitidas y canceladas.",
  "/pagos": "Pagos recibidos y a qué facturas se aplicaron.",
  "/cobranza": "Quién debe, cuánto y con cuántos días de atraso.",
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

  const [conteos, visitas] = await Promise.all([
    conteosDeInicio(sesion),
    proximasVisitas(sesion),
  ]);
  const tarjetas = pendientes(conteos);
  const hoy = hoyEnMexico();
  const color = {
    peligro: "text-destructive",
    aviso: "text-aviso",
    neutro: "text-foreground",
  } as const;

  return (
    <>
      <PageHeader
        title={`Hola, ${primerNombre}`}
        description={`Entraste como ${sesion.rol.nombre}${sesion.puesto ? ` · ${sesion.puesto}` : ""}.`}
      />

      {tarjetas.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Por atender
          </h2>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tarjetas.map((t) => (
              <li key={t.clave}>
                <Link href={t.href} className="block h-full">
                  <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                    <p className="text-sm text-muted-foreground">{t.titulo}</p>
                    <p
                      className={`text-3xl font-semibold tabular-nums ${t.valor > 0 ? color[t.tono] : "text-muted-foreground"}`}
                    >
                      {t.valor}
                    </p>
                    <p
                      className={`text-sm ${t.tono === "peligro" ? "font-medium text-destructive" : "text-muted-foreground"}`}
                    >
                      {t.detalle}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {visitas.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Próximas visitas
          </h2>
          <Card className="gap-0 divide-y py-0">
            {visitas.map((v) => (
              <Link
                key={v.id}
                href={`/ordenes/${v.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm transition-colors hover:bg-accent/40"
              >
                <span className="min-w-0 font-medium break-words">
                  {v.cuentas?.nombre ?? "—"}
                  {v.plantas?.nombre ? ` · ${v.plantas.nombre}` : ""}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {v.fecha_programada
                    ? formatDia(v.fecha_programada)
                    : "Sin fecha"}
                  {v.fecha_programada && v.fecha_programada < hoy ? (
                    <Badge variant="destructive">Atrasada</Badge>
                  ) : null}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}

      {accesos.length > 0 ? (
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Módulos</h2>
      ) : null}
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
    </>
  );
}
