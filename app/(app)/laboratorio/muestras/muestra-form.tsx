"use client";

import { ConfigForm } from "@/components/forms/config-form";
import type { Campo, Valores } from "@/lib/forms/campos";
import { validarMuestra } from "@/lib/laboratorio/muestras";
import { eliminarMuestra, guardarMuestra } from "./actions";

type Props = {
  cuentaId: string;
  /** Vacío al registrar. */
  muestraId: string | null;
  campos: Campo[];
  valores: Valores;
  cancelarHref: string;
};

export function MuestraForm({
  cuentaId,
  muestraId,
  campos,
  valores,
  cancelarHref,
}: Props) {
  return (
    <ConfigForm
      campos={campos}
      valores={valores}
      esEdicion={muestraId !== null}
      validar={validarMuestra}
      guardar={(v) => guardarMuestra(cuentaId, muestraId, v)}
      cancelarHref={cancelarHref}
      textoGuardar={muestraId ? "Guardar cambios" : "Registrar muestra"}
      eliminar={muestraId ? () => eliminarMuestra(muestraId) : undefined}
      confirmarEliminar="¿Eliminar esta muestra? Hazlo solo si se registró por error; si no se va a analizar, mejor márcala como cancelada."
    />
  );
}
