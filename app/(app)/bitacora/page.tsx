import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { TablaLista, type Columna } from "@/components/tabla-lista";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { requirePermiso } from "@/lib/auth/session";
import {
  direccion,
  leerFiltros,
  nombreOperacion,
  nombreTabla,
  OPERACIONES,
  POR_PAGINA,
  resumen,
  TABLAS,
} from "@/lib/bitacora/cambios";
import {
  listarBitacora,
  nombresDeUsuarios,
  type RenglonBitacora,
} from "@/lib/bitacora/data";
import { formatFechaHora } from "@/lib/format";

export const metadata: Metadata = { title: "Bitácora" };

const VARIANTE = {
  INSERT: "exito",
  UPDATE: "secondary",
  DELETE: "neutro",
} as const;

export default async function BitacoraPage({
  searchParams,
}: PageProps<"/bitacora">) {
  await requirePermiso("bitacora.ver");
  const filtros = leerFiltros(await searchParams);
  const [{ renglones, total }, nombres] = await Promise.all([
    listarBitacora(filtros),
    nombresDeUsuarios(),
  ]);
  const quien = (r: RenglonBitacora) =>
    r.usuario_id
      ? (nombres.get(r.usuario_id) ?? "Usuario dado de baja")
      : "Sistema";
  const operacion = (r: RenglonBitacora) => (
    <Badge variant={VARIANTE[r.operacion as keyof typeof VARIANTE] ?? "neutro"}>
      {nombreOperacion(r.operacion)}
    </Badge>
  );
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const hayFiltros = direccion({ ...filtros, pagina: 1 }) !== "/bitacora";
  const etiqueta = "flex flex-col gap-1.5 text-sm font-medium";

  const columnas: Columna<RenglonBitacora>[] = [
    { titulo: "Fecha", celda: (r) => formatFechaHora(r.created_at) },
    { titulo: "Quién", celda: quien },
    { titulo: "Dónde", celda: (r) => nombreTabla(r.tabla) },
    { titulo: "Qué", celda: operacion },
    {
      titulo: "Cambio",
      celda: (r) => (
        <span className="line-clamp-2 max-w-md text-muted-foreground">
          {resumen(r, nombres)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Bitácora"
        description="Quién cambió qué y cuándo en precios, contratos, facturas, pagos, laboratorio y usuarios. Solo se consulta: nada de aquí se edita ni se borra."
      />

      <form
        action="/bitacora"
        className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        {filtros.registro ? (
          <input type="hidden" name="registro" value={filtros.registro} />
        ) : null}
        <label className={etiqueta}>
          Dónde
          <NativeSelect
            name="tabla"
            defaultValue={filtros.tabla}
            className="w-full"
          >
            <NativeSelectOption value="">Todo</NativeSelectOption>
            {Object.entries(TABLAS)
              .sort(([, a], [, b]) => a.localeCompare(b, "es"))
              .map(([clave, nombre]) => (
                <NativeSelectOption key={clave} value={clave}>
                  {nombre}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </label>
        <label className={etiqueta}>
          Quién
          <NativeSelect
            name="usuario"
            defaultValue={filtros.usuario}
            className="w-full"
          >
            <NativeSelectOption value="">Cualquiera</NativeSelectOption>
            {[...nombres].map(([id, nombre]) => (
              <NativeSelectOption key={id} value={id}>
                {nombre}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className={etiqueta}>
          Qué
          <NativeSelect
            name="operacion"
            defaultValue={filtros.operacion}
            className="w-full"
          >
            <NativeSelectOption value="">Todo</NativeSelectOption>
            {Object.entries(OPERACIONES).map(([clave, nombre]) => (
              <NativeSelectOption key={clave} value={clave}>
                {nombre}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className={etiqueta}>
          Desde
          <Input
            type="date"
            name="desde"
            defaultValue={filtros.desde}
            className="h-9 font-normal"
          />
        </label>
        <label className={etiqueta}>
          Hasta
          <Input
            type="date"
            name="hasta"
            defaultValue={filtros.hasta}
            className="h-9 font-normal"
          />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" className="h-9 flex-1">
            Filtrar
          </Button>
          {hayFiltros ? (
            <Link
              href="/bitacora"
              className={buttonVariants({
                variant: "outline",
                className: "h-9",
              })}
            >
              Quitar
            </Link>
          ) : null}
        </div>
      </form>

      {filtros.registro ? (
        <p className="mb-3 text-sm">
          Historial de un solo registro.{" "}
          <Link
            href={direccion({ ...filtros, registro: "", pagina: 1 })}
            className="text-primary underline-offset-4 hover:underline"
          >
            Ver todos
          </Link>
        </p>
      ) : null}
      <p className="mb-3 text-sm text-muted-foreground">
        {total === 0
          ? "No hay registros con esos filtros."
          : `${total} ${total === 1 ? "registro" : "registros"} · página ${filtros.pagina} de ${paginas}`}
      </p>

      {/* Celular: tarjetas */}
      <ul className="space-y-3 lg:hidden">
        {renglones.map((r) => (
          <li key={r.id}>
            <Link href={`/bitacora/${r.id}`} className="block">
              <Card className="gap-1 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{nombreTabla(r.tabla)}</p>
                  {operacion(r)}
                </div>
                <p className="text-sm">
                  {formatFechaHora(r.created_at)}
                  <span className="text-muted-foreground"> · {quien(r)}</span>
                </p>
                <p className="line-clamp-2 text-sm break-words text-muted-foreground">
                  {resumen(r, nombres)}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      {/* Escritorio: tabla */}
      {renglones.length > 0 ? (
        <TablaLista
          filas={renglones}
          columnas={columnas}
          clave={(r) => r.id}
          href={(r) => `/bitacora/${r.id}`}
        />
      ) : null}

      {paginas > 1 ? (
        <nav
          aria-label="Páginas"
          className="mt-4 flex items-center justify-between gap-2"
        >
          {filtros.pagina > 1 ? (
            <Link
              href={direccion({ ...filtros, pagina: filtros.pagina - 1 })}
              className={buttonVariants({
                variant: "outline",
                className: "h-9",
              })}
            >
              Más recientes
            </Link>
          ) : (
            <span />
          )}
          {filtros.pagina < paginas ? (
            <Link
              href={direccion({ ...filtros, pagina: filtros.pagina + 1 })}
              className={buttonVariants({
                variant: "outline",
                className: "h-9",
              })}
            >
              Más antiguos
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
