import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConfigForm } from "@/components/forms/config-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireSesion, tienePermiso } from "@/lib/auth/session";
import { CAMPOS_REQUISITO, camposEquipo } from "@/lib/clientes/campos";
import { listarAceitesActivos, obtenerPlanta } from "@/lib/clientes/data";
import { valoresIniciales, type Fila } from "@/lib/forms/campos";
import {
  eliminarDePlanta,
  guardarDePlanta,
  type EntidadPlanta,
} from "../../../actions";

type Props = {
  entidad: EntidadPlanta;
  cuentaId: string;
  plantaId: string;
  registro: string;
};

/** Alta o edición de un equipo o de un requisito de una planta. */
export async function RegistroPlantaPage({
  entidad,
  cuentaId,
  plantaId,
  registro,
}: Props) {
  const sesion = await requireSesion();
  if (
    !z.uuid().safeParse(cuentaId).success ||
    !z.uuid().safeParse(plantaId).success
  )
    notFound();
  const destino = `/clientes/${cuentaId}/plantas/${plantaId}`;
  if (!tienePermiso(sesion, "clientes.editar")) redirect(destino);

  const planta = await obtenerPlanta(cuentaId, plantaId);
  if (!planta) notFound();

  const esEquipo = entidad === "equipos_cliente";
  const esNuevo = registro === "nuevo";
  const campos = esEquipo
    ? camposEquipo(
        await listarAceitesActivos(),
        tienePermiso(sesion, "precios.ver"),
      )
    : CAMPOS_REQUISITO;

  let fila: (Fila & { id: string }) | undefined;
  if (!esNuevo) {
    if (esEquipo) {
      const equipo = planta.equipos.find((e) => e.id === registro);
      if (equipo) {
        const { aceites, costo, ...datos } = equipo;
        void aceites;
        fila = {
          ...datos,
          costo_aceite_virgen: costo?.costo_aceite_virgen ?? null,
          moneda: costo?.moneda ?? "USD",
        };
      }
    } else {
      fila = planta.requisitos.find((r) => r.id === registro);
    }
    if (!fila) notFound();
  }

  const singular = esEquipo ? "equipo" : "requisito";
  const titulo = `${esNuevo ? "Nuevo" : "Editar"} ${singular}`;
  const nombre = fila
    ? String(esEquipo ? fila.identificador : fila.nombre)
    : null;

  return (
    <div className="mx-auto max-w-xl">
      <title>{`${titulo} · Sistema MOT`}</title>
      <PageHeader
        title={titulo}
        description={`${nombre ? `${nombre} · ` : ""}${planta.nombre} · ${planta.cuenta.nombre}`}
      />
      <Card>
        <CardContent>
          <ConfigForm
            campos={campos}
            valores={valoresIniciales(campos, fila)}
            esEdicion={!esNuevo}
            guardar={guardarDePlanta.bind(
              null,
              entidad,
              cuentaId,
              plantaId,
              fila?.id ?? null,
            )}
            cancelarHref={destino}
            textoGuardar={esNuevo ? `Agregar ${singular}` : "Guardar cambios"}
            eliminar={
              fila
                ? eliminarDePlanta.bind(
                    null,
                    entidad,
                    cuentaId,
                    plantaId,
                    fila.id,
                  )
                : undefined
            }
            confirmarEliminar={nombre ? `¿Eliminar ${nombre}?` : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
