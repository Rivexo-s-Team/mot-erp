import "server-only";
import type { direccionPlanta } from "@/lib/clientes/campos";
import type { ContenidoInforme } from "@/lib/laboratorio/informe";
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
