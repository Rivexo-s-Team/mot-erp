import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { getCatalogo } from "@/lib/catalogos/config";
import { listarCatalogo } from "@/lib/catalogos/data";

export default async function CatalogoPage({
  params,
}: PageProps<"/catalogos/[catalogo]">) {
  const sesion = await requirePermiso("catalogos.ver");
  const catalogo = getCatalogo((await params).catalogo);
  if (!catalogo) notFound();

  const filas = await listarCatalogo(catalogo);
  const puedeEditar = tienePermiso(sesion, catalogo.permisoEditar);
  const [principal, ...resto] = catalogo.columnas;

  return (
    <>
      <title>{`${catalogo.titulo} · Sistema MOT`}</title>
      <PageHeader title={catalogo.titulo} description={catalogo.descripcion}>
        <Link
          href="/catalogos"
          className={buttonVariants({ variant: "outline", className: "h-9" })}
        >
          Catálogos
        </Link>
        {puedeEditar ? (
          <Link
            href={`/catalogos/${catalogo.slug}/nuevo`}
            className={buttonVariants({ className: "h-9" })}
          >
            Agregar
          </Link>
        ) : null}
      </PageHeader>

      {filas.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay registros en este catálogo.
        </Card>
      ) : null}

      {/* Celular: tarjetas */}
      <ul className="space-y-2 sm:hidden">
        {filas.map((fila) => {
          const contenido = (
            <Card className="gap-1 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{catalogo.nombre(fila)}</p>
                {fila.activo ? null : <InactivoBadge />}
              </div>
              {resto.length > 0 ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                  {resto.map((col) => (
                    <div key={col.titulo} className="contents">
                      <dt className="text-muted-foreground">{col.titulo}</dt>
                      <dd className="min-w-0 break-words">{col.valor(fila)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </Card>
          );
          return (
            <li key={String(fila.id)}>
              {puedeEditar ? (
                <Link
                  href={`/catalogos/${catalogo.slug}/${fila.id}`}
                  className="block"
                >
                  {contenido}
                </Link>
              ) : (
                contenido
              )}
            </li>
          );
        })}
      </ul>

      {/* Escritorio: tabla */}
      {filas.length > 0 ? (
        <Card className="hidden overflow-hidden p-0 sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                {catalogo.columnas.map((col) => (
                  <TableHead key={col.titulo}>{col.titulo}</TableHead>
                ))}
                <TableHead>Estado</TableHead>
                {puedeEditar ? (
                  <TableHead className="text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => (
                <TableRow
                  key={String(fila.id)}
                  className={fila.activo ? "" : "text-muted-foreground"}
                >
                  <TableCell className="font-medium whitespace-normal">
                    {principal?.valor(fila)}
                  </TableCell>
                  {resto.map((col) => (
                    <TableCell key={col.titulo} className="whitespace-normal">
                      {col.valor(fila)}
                    </TableCell>
                  ))}
                  <TableCell>
                    {fila.activo ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <InactivoBadge />
                    )}
                  </TableCell>
                  {puedeEditar ? (
                    <TableCell className="text-right">
                      <Link
                        href={`/catalogos/${catalogo.slug}/${fila.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Editar
                      </Link>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </>
  );
}

function InactivoBadge() {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Inactivo
    </Badge>
  );
}
