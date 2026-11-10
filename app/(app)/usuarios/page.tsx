import type { Metadata } from "next";
import Link from "next/link";
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
import { requirePermiso } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const sesion = await requirePermiso("usuarios.administrar");
  const supabase = await createClient();
  const { data: usuarios, error } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, puesto, activo, roles (nombre)")
    .order("nombre");
  if (error) throw new Error("No se pudieron cargar los usuarios.");

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Quién entra al sistema y con qué rol."
      >
        <Link
          href="/usuarios/nuevo"
          className={buttonVariants({ className: "h-9" })}
        >
          Nuevo usuario
        </Link>
      </PageHeader>

      {/* Celular: tarjetas */}
      <ul className="space-y-3 sm:hidden">
        {usuarios.map((u) => (
          <li key={u.id}>
            <Link href={`/usuarios/${u.id}`} className="block">
              <Card className="gap-1 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{u.nombre}</p>
                  <EstadoBadge activo={u.activo} />
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {u.correo}
                </p>
                <p className="text-sm">
                  {u.roles.nombre}
                  {u.id === sesion.id ? " · tú" : ""}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {/* Escritorio: tabla */}
      <Card className="hidden overflow-hidden p-0 sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Puesto</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.nombre}
                  {u.id === sesion.id ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (tú)
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.correo}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.puesto ?? "—"}
                </TableCell>
                <TableCell>{u.roles.nombre}</TableCell>
                <TableCell>
                  <EstadoBadge activo={u.activo} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/usuarios/${u.id}`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Editar
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return activo ? (
    <Badge variant="secondary">Activo</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inactivo
    </Badge>
  );
}
