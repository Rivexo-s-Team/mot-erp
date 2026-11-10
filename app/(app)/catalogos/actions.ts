"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import {
  aFila,
  esquemaCatalogo,
  getCatalogo,
  type Valores,
} from "@/lib/catalogos/config";
import { guardarEnCatalogo } from "@/lib/catalogos/data";

export async function guardarCatalogo(
  slug: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  const catalogo = getCatalogo(slug);
  if (!catalogo) return { error: "Catálogo desconocido." };
  await requirePermiso(catalogo.permisoEditar);

  if (id !== null && !z.uuid().safeParse(id).success)
    return { error: "Registro no válido." };
  const parsed = esquemaCatalogo(catalogo).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const error = await guardarEnCatalogo(
    catalogo,
    id,
    aFila(catalogo, parsed.data, id !== null),
  );
  if (error) return { error };

  revalidatePath(`/catalogos/${catalogo.slug}`);
  redirect(`/catalogos/${catalogo.slug}`);
}
