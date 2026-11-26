import "server-only";
import type { direccionPlanta } from "@/lib/clientes/campos";
import type { ContenidoInforme } from "@/lib/laboratorio/informe";
import type { FilasDeCaptura } from "@/lib/ordenes/captura";
import { createClient } from "@/lib/supabase/server";

export type UsuarioPortal = {
  id: string;
  nombre: string;
  correo: string;
  puesto: string | null;
  activo: boolean;
};

/** Usuarios del portal de una cuenta. Solo los ve quien administra usuarios. */
export async function usuariosPortalDeCuenta(
  cuentaId: string,
): Promise<UsuarioPortal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios_portal")
    .select("perfiles (id, nombre, correo, puesto, activo)")
    .eq("cuenta_id", cuentaId);
  if (error) throw new Error("No se pudieron cargar los usuarios del portal.");
  return data
    .map((u) => u.perfiles)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Cuenta del usuario del portal actual, o null si no pertenece a ninguna. */
export async function miCuentaPortal(): Promise<{
  id: string;
  nombre: string;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_mi_cuenta");
  const cuenta = data?.[0];
  return cuenta ? { id: cuenta.cuenta_id, nombre: cuenta.nombre } : null;
}

// Informes de laboratorio --------------------------------------------------------

/** Informes publicados de la cuenta del usuario del portal, del más reciente al más antiguo. */
export async function informesDelPortal() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_informes");
  if (error) throw new Error("No se pudieron cargar los informes.");
  return data;
}

export type InformePortal = {
  id: string;
  folio: string;
  fecha_emision: string;
  observaciones: string | null;
  recomienda_cambio_filtro: boolean;
  validado_at: string | null;
  contenido: ContenidoInforme;
  cliente: string;
  planta: string;
  direccion: Parameters<typeof direccionPlanta>[0];
  equipo: {
    identificador: string;
    alias: string | null;
    aplicacion: string | null;
    volumen_reservorio_l: number | null;
    aceite: string | null;
  };
  elaboro: string | null;
  valido: string | null;
  id_caso: string | null;
};

/** Un informe publicado de la cuenta del usuario del portal, o null si no le toca. */
export async function informeDelPortal(
  id: string,
): Promise<InformePortal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_informe", {
    p_informe: id,
  });
  if (error) throw new Error("No se pudo cargar el informe.");
  return (data as InformePortal | null) ?? null;
}

// Facturas y pagos ---------------------------------------------------------------

/** Facturas emitidas de la cuenta del usuario del portal, de la más reciente a la más antigua. */
export async function facturasDelPortal() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_facturas");
  if (error) throw new Error("No se pudieron cargar las facturas.");
  return data;
}

export type FacturaPortal = {
  id: string;
  serie: string | null;
  folio: string | null;
  uuid_fiscal: string | null;
  fecha: string;
  moneda: string;
  tipo_cambio: number | null;
  metodo_pago: string | null;
  forma_pago: string | null;
  uso_cfdi: string | null;
  orden_compra: string | null;
  dias_credito: number;
  es_anticipo: boolean;
  razon_social: string;
  rfc: string;
  subtotal: number;
  iva: number;
  total: number;
  pagado: number;
  saldo: number;
  tiene_xml: boolean;
  tiene_pdf: boolean;
  conceptos: {
    descripcion: string;
    cantidad: number;
    unidad: string | null;
    precio_unitario: number;
    importe: number;
  }[];
  pagos: {
    fecha: string;
    monto: number;
    forma_pago: string | null;
    es_anticipo: boolean;
    rep_folio: string | null;
    rep_uuid: string | null;
  }[];
};

/** Una factura emitida de la cuenta del usuario del portal, o null si no le toca. */
export async function facturaDelPortal(
  id: string,
): Promise<FacturaPortal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_factura", {
    p_factura: id,
  });
  if (error) throw new Error("No se pudo cargar la factura.");
  return (data as FacturaPortal | null) ?? null;
}

export type AplicacionPortal = {
  factura_id: string;
  serie: string | null;
  folio: string | null;
  monto: number;
};

/** Pagos de la cuenta del usuario del portal, del más reciente al más antiguo. */
export async function pagosDelPortal() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_pagos");
  if (error) throw new Error("No se pudieron cargar los pagos.");
  return data.map((p) => ({
    ...p,
    aplicaciones: p.aplicaciones as AplicacionPortal[],
  }));
}

/** Ruta en el almacén del XML o PDF de una factura del cliente, o null. */
export async function rutaArchivoFacturaPortal(
  id: string,
  tipo: "xml" | "pdf",
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_factura_archivo", {
    p_factura: id,
    p_tipo: tipo,
  });
  return data ?? null;
}

// Órdenes de servicio ------------------------------------------------------------

/** Visitas cerradas en las plantas de la cuenta del usuario del portal, de la más reciente a la más antigua. */
export async function ordenesDelPortal() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_ordenes");
  if (error) throw new Error("No se pudieron cargar las órdenes.");
  return data;
}

export type OrdenPortal = {
  orden: {
    id: string;
    folio: string;
    tipo: string;
    estado: string;
    fecha_programada: string;
    fecha_real: string | null;
    cliente: string;
    planta: string;
    direccion: Parameters<typeof direccionPlanta>[0];
    robox: string | null;
    tecnico: string | null;
    acompanante: string | null;
  };
  equipo: {
    identificador: string;
    alias: string | null;
    aplicacion: string | null;
    aceite: string | null;
  } | null;
  filas: FilasDeCaptura;
  catalogos: Record<
    "actividades" | "fallas" | "partes",
    { id: string; nombre: string }[]
  >;
};

/** Una visita cerrada de la cuenta del usuario del portal, o null si no le toca. */
export async function ordenDelPortal(id: string): Promise<OrdenPortal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_orden", { p_orden: id });
  if (error) throw new Error("No se pudo cargar la orden.");
  return (data as OrdenPortal | null) ?? null;
}
