"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import {
  contenidoDeInforme,
  muestrasDeEquipo,
  obtenerInforme,
  opcionesMuestra,
} from "@/lib/laboratorio/data";
import { accionesInforme, folioSugerido } from "@/lib/laboratorio/informe";
import {
  camposInformeEdicion,
  camposInformeNuevo,
  esCampoDeInforme,
  muestrasMarcadas,
} from "@/lib/laboratorio/informe-campos";
import { createClient } from "@/lib/supabase/server";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

async function cliente() {
  return (await createClient()) as unknown as SupabaseClient;
}

function mensajeError(e: { code?: string; message?: string } | null): string {
  if (e?.code === "23505") return "Ya existe un informe con ese folio.";
  if (e?.code === "23503") return "Una muestra no es del equipo del informe.";
  if (e?.code === "P0001" && e.message) return e.message;
  if (e?.code === "42501" || !e) return "Tu rol no puede hacer este cambio.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar(id?: string) {
  revalidatePath("/laboratorio/informes");
  if (id) revalidatePath(`/laboratorio/informes/${id}`);
}

/** Crea el informe de un equipo con todas sus muestras que ya tienen resultados. */
export async function crearInforme(
  cuentaId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("laboratorio.editar");
  if (!esId(cuentaId)) return { error: "Registro no válido." };
  const { equipos } = await opcionesMuestra(cuentaId);
  const campos = camposInformeNuevo(equipos, hoyEnMexico());
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const fila = aFila(campos, parsed.data, false);
  const equipoId = String(fila.equipo_cliente_id);

  const supabase = await cliente();
  const { data: equipo } = await supabase
    .from("equipos_cliente")
    .select("planta_id, plantas!inner (cuenta_id)")
    .eq("id", equipoId)
    .eq("plantas.cuenta_id", cuentaId)
    .maybeSingle();
  if (!equipo) return { error: "El equipo no es de ese cliente." };

  const muestras = (await muestrasDeEquipo(equipoId)).filter(
    (m) => Object.keys(m.resultados).length > 0,
  );
  if (muestras.length === 0)
    return {
      error:
        "Ese equipo aún no tiene muestras con resultados. Captúralos antes de elaborar el informe.",
    };
  const folio = fila.folio ?? folioSugerido(muestras.at(-1)?.id_muestra);

  const { data, error } = await supabase
    .from("informes")
    .insert({
      ...fila,
      folio,
      cuenta_id: cuentaId,
      planta_id: equipo.planta_id,
    })
    .select("id");
  const nuevo = data?.[0] as { id: string } | undefined;
  if (error || !nuevo)
    return {
      error:
        error?.code === "23505"
          ? `Ya existe un informe con el folio ${folio}. Escribe otro.`
          : mensajeError(error),
    };

  const { error: errorMuestras } = await supabase
    .from("informe_muestras")
    .insert(
      muestras.map((m) => ({
        informe_id: nuevo.id,
        muestra_id: m.id,
        equipo_cliente_id: equipoId,
      })),
    );
  refrescar(nuevo.id);
  if (errorMuestras)
    return {
      error:
        "El informe se creó, pero no se pudieron agregar sus muestras. Ábrelo desde la lista y agrégalas en Editar.",
    };
  redirect(`/laboratorio/informes/${nuevo.id}`);
}

/** Corrige un informe en borrador: folio, fecha, observaciones y muestras incluidas. */
export async function guardarInforme(
  id: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("laboratorio.editar");
  if (!esId(id)) return { error: "Registro no válido." };
  const informe = await obtenerInforme(id);
  if (!informe) return { error: "El informe ya no existe." };
  if (!accionesInforme(informe.estado).editar)
    return { error: "El informe ya está validado. Reábrelo para corregirlo." };

  const delEquipo = await muestrasDeEquipo(informe.equipo_cliente_id);
  const campos = camposInformeEdicion(delEquipo, hoyEnMexico());
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const marcadas = new Set(muestrasMarcadas(parsed.data));
  if (marcadas.size === 0)
    return { error: "El informe debe incluir al menos una muestra." };

  const supabase = await cliente();
  const { data, error } = await supabase
    .from("informes")
    .update(aFila(campos.filter(esCampoDeInforme), parsed.data, true))
    .eq("id", id)
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };

  const actuales = new Set(informe.informe_muestras.map((m) => m.muestra_id));
  const quitar = [...actuales].filter((m) => !marcadas.has(m));
  const agregar = [...marcadas].filter((m) => !actuales.has(m));
  if (quitar.length > 0) {
    const r = await supabase
      .from("informe_muestras")
      .delete()
      .eq("informe_id", id)
      .in("muestra_id", quitar);
    if (r.error) return { error: mensajeError(r.error) };
  }
  if (agregar.length > 0) {
    const r = await supabase.from("informe_muestras").insert(
      agregar.map((m) => ({
        informe_id: id,
        muestra_id: m,
        equipo_cliente_id: informe.equipo_cliente_id,
      })),
    );
    if (r.error) return { error: mensajeError(r.error) };
  }
  refrescar(id);
  redirect(`/laboratorio/informes/${id}`);
}

/**
 * Valida el informe: guarda una copia fija de lo que dice en este momento.
 * Desde entonces no cambia, aunque cambien los límites o los resultados.
 */
export async function validarInforme(id: string): Promise<ActionResult> {
  await requirePermiso("laboratorio.validar");
  if (!esId(id)) return { error: "Registro no válido." };
  const informe = await obtenerInforme(id);
  if (!informe) return { error: "El informe ya no existe." };
  if (!accionesInforme(informe.estado).validar)
    return { error: "El informe ya estaba validado." };
  const contenido = await contenidoDeInforme(informe);
  if (contenido.muestras.length === 0)
    return { error: "El informe no tiene muestras." };

  const supabase = await cliente();
  const { data, error } = await supabase
    .from("informes")
    .update({ estado: "validado", contenido })
    .eq("id", id)
    .eq("estado", "borrador")
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(id);
  return undefined;
}

/** Regresa un informe validado a borrador para corregirlo; se borra la validación. */
export async function reabrirInforme(id: string): Promise<ActionResult> {
  await requirePermiso("laboratorio.validar");
  if (!esId(id)) return { error: "Registro no válido." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("informes")
    .update({ estado: "borrador" })
    .eq("id", id)
    .eq("estado", "validado")
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(id);
  return undefined;
}

/**
 * Publica un informe validado en el portal del cliente, o lo retira. Solo
 * cambia eso: la base no deja tocar nada más de un informe validado.
 */
export async function publicarInforme(
  id: string,
  publicar: boolean,
): Promise<ActionResult> {
  await requirePermiso("laboratorio.validar");
  if (!esId(id)) return { error: "Registro no válido." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("informes")
    .update({ publicado_at: publicar ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("estado", "validado")
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(id);
  return undefined;
}

/** Quita un informe en borrador creado por error. */
export async function eliminarInforme(id: string): Promise<ActionResult> {
  await requirePermiso("laboratorio.editar");
  if (!esId(id)) return { error: "Registro no válido." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("informes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(id);
  redirect("/laboratorio/informes");
}
