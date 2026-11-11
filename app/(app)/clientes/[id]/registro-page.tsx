import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireSesion, tienePermiso } from "@/lib/auth/session";
import {
  CAMPOS_RAZON_SOCIAL,
  camposContacto,
  camposPlanta,
} from "@/lib/clientes/campos";
import { obtenerCuenta, type CuentaCompleta } from "@/lib/clientes/data";
import { valoresIniciales, type Campo, type Fila } from "@/lib/forms/campos";
import {
  eliminarDeCuenta,
  guardarDeCuenta,
  type EntidadCuenta,
} from "../actions";

type Definicion = {
  permiso: string;
  singular: string;
  /** Segmento de la URL que significa "registro nuevo". */
  nuevo: "nueva" | "nuevo";
  titulos: { nuevo: string; editar: string };
  campos: (cuenta: CuentaCompleta) => Campo[];
  filas: (cuenta: CuentaCompleta) => (Fila & { id: string })[];
  nombre: (fila: Fila) => string;
};

const DEFINICIONES: Record<EntidadCuenta, Definicion> = {
  plantas: {
    permiso: "clientes.editar",
    singular: "planta",
    nuevo: "nueva",
    titulos: { nuevo: "Nueva planta", editar: "Editar planta" },
    campos: (c) =>
      camposPlanta(
        c.razonesSociales.map((r) => ({
          value: r.id,
          label: `${r.razon_social} (${r.rfc})`,
        })),
      ),
    filas: (c) => c.plantas,
    nombre: (f) => String(f.nombre),
  },
  razones_sociales: {
    permiso: "razones_sociales.editar",
    singular: "razón social",
    nuevo: "nueva",
    titulos: { nuevo: "Nueva razón social", editar: "Editar razón social" },
    campos: () => CAMPOS_RAZON_SOCIAL,
    filas: (c) => c.razonesSociales,
    nombre: (f) => String(f.razon_social),
  },
  contactos: {
    permiso: "clientes.editar",
    singular: "contacto",
    nuevo: "nuevo",
    titulos: { nuevo: "Nuevo contacto", editar: "Editar contacto" },
    campos: (c) =>
      camposContacto(c.plantas.map((p) => ({ value: p.id, label: p.nombre }))),
    filas: (c) => c.contactos,
    nombre: (f) => String(f.nombre),
  },
};

type RegistroPageProps = {
  entidad: EntidadCuenta;
  cuentaId: string;
  registro: string;
};

/** Alta o edición de una planta, razón social o contacto de una cuenta. */
export async function RegistroPage({
  entidad,
  cuentaId,
  registro,
}: RegistroPageProps) {
  const def = DEFINICIONES[entidad];
  const sesion = await requireSesion();
  if (!z.uuid().safeParse(cuentaId).success) notFound();
  if (!tienePermiso(sesion, def.permiso)) redirect(`/clientes/${cuentaId}`);

  const cuenta = await obtenerCuenta(cuentaId);
  if (!cuenta) notFound();

  const esNuevo = registro === def.nuevo;
  const fila = esNuevo
    ? undefined
    : def.filas(cuenta).find((f) => f.id === registro);
  if (!esNuevo && !fila) notFound();

  const campos = def.campos(cuenta);
  const id = fila?.id ?? null;
  const titulo = esNuevo ? def.titulos.nuevo : def.titulos.editar;

  return (
    <div className="mx-auto max-w-xl">
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader
        title={titulo}
        description={
          fila ? `${def.nombre(fila)} · ${cuenta.nombre}` : cuenta.nombre
        }
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={campos}
            valores={valoresIniciales(campos, fila)}
            esEdicion={!esNuevo}
            guardar={guardarDeCuenta.bind(null, entidad, cuentaId, id)}
            cancelarHref={`/clientes/${cuentaId}`}
            textoGuardar={
              esNuevo ? `Agregar ${def.singular}` : "Guardar cambios"
            }
            eliminar={
              id
                ? eliminarDeCuenta.bind(null, entidad, cuentaId, id)
                : undefined
            }
            confirmarEliminar={
              fila ? `¿Eliminar ${def.nombre(fila)}?` : undefined
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
