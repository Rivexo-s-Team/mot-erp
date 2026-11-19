"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ARCHIVOS_PDF,
  ARCHIVOS_XML,
  BUCKETS,
  validarArchivo,
  type MetaArchivo,
} from "@/lib/archivos/config";
import {
  existeEnStorage,
  permisoTemporal,
  type Subida,
} from "@/lib/archivos/subida";
import type { ActionResult } from "@/lib/auth/schemas";
import { requirePermiso } from "@/lib/auth/session";
import { leerCfdi, problemaConCfdi } from "@/lib/facturacion/cfdi";
import { obtenerFactura } from "@/lib/facturacion/data";
import { esImporte } from "@/lib/facturacion/pagos";
import {
  accionesFactura,
  CAMPOS_CANCELACION,
  CAMPOS_CONCEPTO,
  camposEmision,
  camposFactura,
  validarEmision,
  validarFactura,
} from "@/lib/facturacion/facturas";
import { aFila, esquemaCampos, type Valores } from "@/lib/forms/campos";
import { hoyEnMexico } from "@/lib/format";
import { CAMPOS_PORTAL, validarPortal } from "@/lib/facturacion/cobranza";
import { createClient } from "@/lib/supabase/server";

const esId = (v: unknown): v is string => z.uuid().safeParse(v).success;

async function cliente() {
  return (await createClient()) as unknown as SupabaseClient;
}

function mensajeError(e: { code?: string; message?: string } | null): string {
  if (e?.code === "P0001" && e.message) return e.message;
  if (e?.code === "23514")
    return "Revisa la forma de pago y el tipo de cambio.";
  if (e?.code === "42501" || !e) return "Tu rol no puede cambiar facturas.";
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

function refrescar(id?: string) {
  revalidatePath("/facturas");
  revalidatePath("/cargos");
  if (id) revalidatePath(`/facturas/${id}`);
}

/**
 * Arma una factura en borrador con los cargos marcados en el formulario
 * (campos `razon_social` y `cargo`). Si algo no procede vuelve a la pantalla
 * con el motivo.
 */
export async function crearFactura(
  cuentaId: string,
  datos: FormData,
): Promise<void> {
  await requirePermiso("facturacion.editar");
  const volver = (motivo: string) =>
    redirect(
      `/facturas/nueva?cuenta=${cuentaId}&error=${encodeURIComponent(motivo)}`,
    );
  if (!esId(cuentaId)) redirect("/facturas/nueva");
  const razon = datos.get("razon_social");
  const cargos = datos.getAll("cargo").filter(esId);
  if (!esId(razon)) return volver("Elige la razón social a la que se factura.");
  if (cargos.length === 0) return volver("Marca al menos un cargo.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_factura", {
    p_razon_social: razon,
    p_cargos: cargos,
  });
  if (error || !data) return volver(mensajeError(error));
  refrescar(data);
  redirect(`/facturas/${data}`);
}

/** Corrige el encabezado de una factura en borrador. */
export async function guardarFactura(
  id: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(id)) return { error: "Registro no válido." };
  const factura = await obtenerFactura(id);
  if (!factura) return { error: "La factura ya no existe." };
  if (!accionesFactura(factura.estado).editar)
    return { error: "La factura ya no es un borrador." };

  const campos = camposFactura(factura.moneda, hoyEnMexico());
  const parsed = esquemaCampos(campos, validarFactura).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const { data, error } = await (
    await cliente()
  )
    .from("facturas")
    .update(aFila(campos, parsed.data, true))
    .eq("id", id)
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(id);
  redirect(`/facturas/${id}`);
}

/** Corrige la descripción y las claves del SAT de un concepto. */
export async function guardarConcepto(
  facturaId: string,
  conceptoId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(facturaId) || !esId(conceptoId))
    return { error: "Registro no válido." };
  const parsed = esquemaCampos(CAMPOS_CONCEPTO).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const { data, error } = await (
    await cliente()
  )
    .from("factura_conceptos")
    .update(aFila(CAMPOS_CONCEPTO, parsed.data, true))
    .eq("id", conceptoId)
    .eq("factura_id", facturaId)
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(facturaId);
  redirect(`/facturas/${facturaId}`);
}

/** Quita un concepto del borrador; su cargo vuelve a quedar por facturar. */
export async function quitarConcepto(
  facturaId: string,
  conceptoId: string,
): Promise<void> {
  await requirePermiso("facturacion.editar");
  if (!esId(facturaId) || !esId(conceptoId)) return;
  await (
    await cliente()
  )
    .from("factura_conceptos")
    .delete()
    .eq("id", conceptoId)
    .eq("factura_id", facturaId);
  refrescar(facturaId);
  redirect(`/facturas/${facturaId}`);
}

/** Elimina un borrador; sus cargos vuelven a quedar por facturar. */
export async function eliminarFactura(id: string): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(id)) return { error: "Registro no válido." };
  const { data, error } = await (
    await cliente()
  )
    .from("facturas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(id);
  redirect("/facturas");
}

/**
 * Registra que la factura ya se timbró (fuera del sistema, D42) o corrige un
 * dato mal capturado de ese registro. Al quedar emitida, sus cargos pasan a
 * facturados.
 */
export async function registrarEmision(
  id: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(id)) return { error: "Registro no válido." };
  const factura = await obtenerFactura(id);
  if (!factura) return { error: "La factura ya no existe." };
  const acciones = accionesFactura(factura.estado);
  if (!acciones.emitir && !acciones.corregirRegistro)
    return { error: "La factura está cancelada." };
  // El XML ya comprobó el folio fiscal: no se cambia después.
  if (factura.xml_ruta)
    return { error: "La factura ya tiene su XML: su registro no se corrige." };

  const campos = camposEmision(factura.moneda, hoyEnMexico());
  const parsed = esquemaCampos(campos, validarEmision).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const fila = aFila(campos, parsed.data, false);

  const { data, error } = await (
    await cliente()
  )
    .from("facturas")
    .update({
      ...fila,
      uuid_fiscal: String(fila.uuid_fiscal).toLowerCase(),
      estado: "emitida",
    })
    .eq("id", id)
    .select("id");
  if (error || !data?.[0])
    return {
      error:
        error?.code === "23505"
          ? "Ese folio fiscal ya está registrado en otra factura."
          : mensajeError(error),
    };
  refrescar(id);
  redirect(`/facturas/${id}`);
}

/** Cancela una factura emitida; sus cargos vuelven a quedar por facturar. */
export async function cancelarFactura(
  id: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(id)) return { error: "Registro no válido." };
  const parsed = esquemaCampos(CAMPOS_CANCELACION).safeParse(valores);
  if (!parsed.success) return { error: "Escribe el motivo de la cancelación." };

  const { data, error } = await (
    await cliente()
  )
    .from("facturas")
    .update({ ...parsed.data, estado: "cancelada" })
    .eq("id", id)
    .eq("estado", "emitida")
    .select("id");
  if (error || !data?.[0]) return { error: mensajeError(error) };
  refrescar(id);
  redirect(`/facturas/${id}`);
}

type TipoArchivo = "xml" | "pdf";
const ARCHIVOS = { xml: ARCHIVOS_XML, pdf: ARCHIVOS_PDF } as const;

/** Por qué no se puede subir ese archivo a la factura, o null si se puede. */
async function problemaArchivo(
  id: string,
  tipo: TipoArchivo,
  meta: MetaArchivo,
) {
  if (!esId(id) || !(tipo in ARCHIVOS)) return "Registro no válido.";
  const problema = validarArchivo(meta, ARCHIVOS[tipo]);
  if (problema) return problema;
  const factura = await obtenerFactura(id);
  if (!factura) return "La factura ya no existe.";
  if (!accionesFactura(factura.estado).subirArchivos)
    return "Los archivos se suben cuando la factura ya está registrada como emitida.";
  if (tipo === "xml" ? factura.xml_ruta : factura.pdf_ruta)
    return `La factura ya tiene su ${tipo.toUpperCase()}.`;
  return null;
}

/** Paso 1 de la subida del XML o el PDF de una factura emitida. */
export async function prepararArchivoFactura(
  id: string,
  tipo: TipoArchivo,
  meta: MetaArchivo,
): Promise<Subida | { error: string }> {
  await requirePermiso("facturacion.editar");
  const motivo = await problemaArchivo(id, tipo, meta);
  if (motivo) return { error: motivo };
  return permisoTemporal(BUCKETS.factura, id, meta, ARCHIVOS[tipo]);
}

/**
 * Paso 2: confirma que el archivo llegó y lo liga a la factura. El XML además
 * se lee: tiene que ser el de esta factura (mismo folio fiscal, RFC y moneda).
 */
export async function registrarArchivoFactura(
  id: string,
  tipo: TipoArchivo,
  ruta: string,
  meta: MetaArchivo,
): Promise<{ error: string } | undefined> {
  await requirePermiso("facturacion.editar");
  const motivo = await problemaArchivo(id, tipo, meta);
  if (motivo) return { error: motivo };
  if (!(await existeEnStorage(BUCKETS.factura, id, ruta)))
    return { error: "El archivo no terminó de subirse. Intenta de nuevo." };

  const fila: Record<string, string | number | null> =
    tipo === "pdf" ? { pdf_ruta: ruta } : { xml_ruta: ruta };
  if (tipo === "xml") {
    const factura = await obtenerFactura(id);
    const supabase = await createClient();
    const { data: archivo } = await supabase.storage
      .from(BUCKETS.factura)
      .download(ruta);
    const cfdi = archivo ? leerCfdi(await archivo.text()) : null;
    const problema = problemaConCfdi(cfdi, {
      uuid_fiscal: factura?.uuid_fiscal ?? null,
      rfc: factura?.razones_sociales?.rfc ?? null,
      moneda: factura?.moneda ?? "",
    });
    if (problema) return { error: problema };
    fila.xml_total = cfdi?.total ?? null;
  }

  const { data, error } = await (
    await cliente()
  )
    .from("facturas")
    .update(fila)
    .eq("id", id)
    .select("id");
  if (error || !data?.[0])
    return { error: "El archivo se subió, pero no se pudo registrar." };
  refrescar(id);
}

/**
 * Descuenta de una factura parte de un anticipo que el cliente ya pagó. La
 * base revisa que alcance lo disponible y el saldo de la factura.
 */
export async function aplicarAnticipo(
  facturaId: string,
  formulario: FormData,
): Promise<void> {
  await requirePermiso("facturacion.editar");
  if (!esId(facturaId)) redirect("/facturas");
  const volver = (motivo?: string) =>
    redirect(
      `/facturas/${facturaId}${motivo ? `?error=${encodeURIComponent(motivo)}` : ""}`,
    );
  const anticipo = formulario.get("anticipo");
  const monto = String(formulario.get("monto") ?? "").trim();
  if (!esId(anticipo)) return volver("Elige el anticipo.");
  if (!esImporte(monto))
    return volver("Escribe el monto a aplicar, por ejemplo 348.00.");

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { error } = await supabase.rpc("aplicar_anticipo", {
    p_anticipo: anticipo,
    p_factura: facturaId,
    p_monto: monto,
    p_fecha: hoyEnMexico(),
  });
  refrescar(facturaId);
  revalidatePath("/pagos");
  revalidatePath("/facturas", "layout");
  return volver(error ? mensajeError(error) : undefined);
}

/** Guarda cómo va la factura en el portal de proveedores del cliente. */
export async function guardarPortal(
  facturaId: string,
  valores: Valores,
): Promise<ActionResult> {
  await requirePermiso("facturacion.editar");
  if (!esId(facturaId)) return { error: "Registro no válido." };
  const parsed = esquemaCampos(CAMPOS_PORTAL, validarPortal).safeParse(valores);
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const v = parsed.data;
  const { error } = await (await cliente()).from("portal_proveedor").upsert(
    {
      factura_id: facturaId,
      estado: v.estado,
      fecha_subida: v.fecha_subida || null,
      fecha_aprobacion: v.fecha_aprobacion || null,
      fecha_pago_programado: v.fecha_pago_programado || null,
      notas: v.notas || null,
    },
    { onConflict: "factura_id" },
  );
  if (error)
    return {
      error:
        error.code === "23514"
          ? "Revisa las fechas: la de subida es obligatoria y la aprobación no puede ser anterior."
          : mensajeError(error),
    };
  refrescar(facturaId);
  revalidatePath("/cobranza");
  redirect(`/facturas/${facturaId}`);
}
