"use client";

import { ConfigForm } from "@/components/forms/config-form";
import { getCatalogo, type Valores } from "@/lib/catalogos/config";
import { guardarCatalogo } from "./actions";

type CatalogoFormProps = {
  slug: string;
  /** null = registro nuevo. */
  id: string | null;
  valores: Valores;
};

export function CatalogoForm({ slug, id, valores }: CatalogoFormProps) {
  // La configuración tiene funciones, así que se busca aquí y no se pasa como prop.
  const catalogo = getCatalogo(slug)!;

  return (
    <ConfigForm
      campos={catalogo.campos}
      valores={valores}
      esEdicion={id !== null}
      validar={catalogo.validar}
      guardar={(v) => guardarCatalogo(slug, id, v)}
      cancelarHref={`/catalogos/${slug}`}
      textoGuardar={
        id !== null ? "Guardar cambios" : `Agregar ${catalogo.singular}`
      }
    />
  );
}
