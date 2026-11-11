"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import {
  CAMPOS_COSTO,
  CAMPOS_CUENTA,
  CAMPOS_RAZON_SOCIAL,
  CAMPOS_REQUISITO,
  camposContacto,
  camposEquipo,
  camposPlanta,
} from "@/lib/clientes/campos";
import {
  aFila,
  esquemaCampos,
  type Campo,
  type Fila,
  type Valores,
} from "@/lib/forms/campos";
import { createClient } from "@/lib/supabase/server";

/** Lo que cuelga de una cuenta. Las opciones de planta y razón social las valida la base. */
const ENTIDADES = {
  plantas: {
    campos: camposPlanta([]),
    permiso: "clientes.editar",
    nombre: "la planta",
  },
  razones_sociales: {
    campos: CAMPOS_RAZON_SOCIAL,
    permiso: "razones_sociales.editar",
    nombre: "la razón social",
  },
  contactos: {
    campos: camposContacto([]),
    permiso: "clientes.editar",
    nombre: "el contacto",
  },
} satisfies Record<
  string,
  { campos: Campo[]; permiso: string; nombre: string }
>;

export type EntidadCuenta = keyof typeof ENTIDADES;

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

/** Las tablas se nombran aquí, nunca con datos del usuario; RLS decide el acceso. */
async function tabla(
  nombre: "cuentas" | EntidadCuenta | EntidadPlanta | "equipos_cliente_costos",
) {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  return supabase.from(nombre);
}

function mensajeError(code: string | undefined, que: string): string {
  if (code === "23505")
    return `Ya existe ${que} con ese nombre o RFC en esta cuenta.`;
  if (code === "23503")
    return "Uno de los datos elegidos no pertenece a esta cuenta.";
  if (code === "42501") return "Tu rol no puede hacer este cambio.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

export async function guardarCuenta(
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("clientes.editar");
  if (id !== null && !esId(id)) return { error: "Registro no válido." };
  const parsed = esquemaCampos(CAMPOS_CUENTA).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const fila = aFila(CAMPOS_CUENTA, parsed.data, id !== null);
  const t = await tabla("cuentas");
  const { data, error } = id
    ? await t.update(fila).eq("id", id).select("id")
    : await t.insert(fila).select("id");
  if (error?.code === "23505")
    return { error: "Ya existe una cuenta con ese nombre." };
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501", "una cuenta") };

  const cuentaId = (data[0] as { id: string }).id;
  revalidatePath("/clientes");
  redirect(`/clientes/${cuentaId}`);
}

export async function guardarDeCuenta(
  entidad: EntidadCuenta,
  cuentaId: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  const config = ENTIDADES[entidad];
  if (!config) return { error: "Registro no válido." };
  await requirePermiso(config.permiso);
  if (!esId(cuentaId) || (id !== null && !esId(id)))
    return { error: "Registro no válido." };

  const parsed = esquemaCampos(config.campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const fila: Fila = aFila(config.campos, parsed.data, id !== null);

  const t = await tabla(entidad);
  const { data, error } = id
    ? await t.update(fila).eq("id", id).eq("cuenta_id", cuentaId).select("id")
    : await t.insert({ ...fila, cuenta_id: cuentaId }).select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501", config.nombre) };

  revalidatePath(`/clientes/${cuentaId}`);
  redirect(`/clientes/${cuentaId}`);
}

/** Borrado lógico: el registro se marca y deja de aparecer, pero no se pierde. */
export async function eliminarDeCuenta(
  entidad: EntidadCuenta,
  cuentaId: string,
  id: string,
): Promise<ActionResult> {
  const config = ENTIDADES[entidad];
  if (!config) return { error: "Registro no válido." };
  await requirePermiso(config.permiso);
  if (!esId(cuentaId) || !esId(id)) return { error: "Registro no válido." };

  if (entidad === "razones_sociales") {
    // Una planta no debe quedar apuntando a una razón social eliminada.
    const { count } = await (
      await tabla("plantas")
    )
      .select("id", { count: "exact", head: true })
      .eq("razon_social_id", id)
      .is("deleted_at", null);
    if (count) {
      return {
        error:
          "Hay plantas que facturan a esta razón social. Cámbiales la razón social primero.",
      };
    }
  }

  const { data, error } = await (
    await tabla(entidad)
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("cuenta_id", cuentaId)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501", config.nombre) };

  revalidatePath(`/clientes/${cuentaId}`);
  redirect(`/clientes/${cuentaId}`);
}

export async function eliminarCuenta(id: string): Promise<ActionResult> {
  await requirePermiso("clientes.editar");
  if (!esId(id)) return { error: "Registro no válido." };

  const { data, error } = await (
    await tabla("cuentas")
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0])
    return { error: mensajeError(error?.code ?? "42501", "la cuenta") };

  revalidatePath("/clientes");
  redirect("/clientes");
}

// ---------------------------------------------------------------------------
// Lo que cuelga de una planta: equipos y requisitos
// ---------------------------------------------------------------------------

export type EntidadPlanta = "equipos_cliente" | "requisitos_planta";

const NOMBRES_PLANTA: Record<EntidadPlanta, string> = {
  equipos_cliente: "un equipo",
  requisitos_planta: "un requisito",
};

/** Confirma (con la sesión del usuario) que la planta existe y es de esa cuenta. */
async function plantaDeCuenta(
  cuentaId: string,
  plantaId: string,
): Promise<boolean> {
  if (!esId(cuentaId) || !esId(plantaId)) return false;
  const { data } = await (
    await tabla("plantas")
  )
    .select("id")
    .eq("id", plantaId)
    .eq("cuenta_id", cuentaId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function guardarDePlanta(
  entidad: EntidadPlanta,
  cuentaId: string,
  plantaId: string,
  id: string | null,
  valores: Valores,
): Promise<ActionResult> {
  const sesion = await requirePermiso("clientes.editar");
  if (!(entidad in NOMBRES_PLANTA) || (id !== null && !esId(id))) {
    return { error: "Registro no válido." };
  }
  if (!(await plantaDeCuenta(cuentaId, plantaId)))
    return { error: "La planta no existe." };

  // El costo del aceite solo lo captura quien puede ver precios.
  const conCosto =
    entidad === "equipos_cliente" && tienePermiso(sesion, "precios.ver");
  const campos =
    entidad === "equipos_cliente"
      ? camposEquipo([], conCosto)
      : CAMPOS_REQUISITO;
  const parsed = esquemaCampos(campos).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const nombresCosto: readonly string[] = CAMPOS_COSTO;
  const fila = aFila(
    campos.filter((c) => !nombresCosto.includes(c.name)),
    parsed.data,
    id !== null,
  );

  const t = await tabla(entidad);
  const { data, error } = id
    ? await t.update(fila).eq("id", id).eq("planta_id", plantaId).select("id")
    : await t.insert({ ...fila, planta_id: plantaId }).select("id");
  if (error?.code === "23505") {
    return {
      error: "Ya existe un equipo con ese identificador en esta planta.",
    };
  }
  if (error || !data?.[0]) {
    return {
      error: mensajeError(error?.code ?? "42501", NOMBRES_PLANTA[entidad]),
    };
  }

  if (conCosto) {
    const equipoId = (data[0] as { id: string }).id;
    const costo = String(parsed.data.costo_aceite_virgen ?? "");
    const costos = await tabla("equipos_cliente_costos");
    const resultado =
      costo === ""
        ? await costos.delete().eq("equipo_cliente_id", equipoId)
        : await costos.upsert({
            equipo_cliente_id: equipoId,
            costo_aceite_virgen: Number(costo),
            moneda: String(parsed.data.moneda),
          });
    if (resultado.error) {
      return {
        error:
          "Se guardó el equipo, pero no su costo de aceite. Intenta de nuevo.",
      };
    }
  }

  const destino = `/clientes/${cuentaId}/plantas/${plantaId}`;
  revalidatePath(destino);
  redirect(destino);
}

export async function eliminarDePlanta(
  entidad: EntidadPlanta,
  cuentaId: string,
  plantaId: string,
  id: string,
): Promise<ActionResult> {
  await requirePermiso("clientes.editar");
  if (!(entidad in NOMBRES_PLANTA) || !esId(id))
    return { error: "Registro no válido." };
  if (!(await plantaDeCuenta(cuentaId, plantaId)))
    return { error: "La planta no existe." };

  const { data, error } = await (
    await tabla(entidad)
  )
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("planta_id", plantaId)
    .select("id");
  if (error || !data?.[0]) {
    return {
      error: mensajeError(error?.code ?? "42501", NOMBRES_PLANTA[entidad]),
    };
  }

  const destino = `/clientes/${cuentaId}/plantas/${plantaId}`;
  revalidatePath(destino);
  redirect(destino);
}
