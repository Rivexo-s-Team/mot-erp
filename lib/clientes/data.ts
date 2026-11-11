import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Lecturas del expediente del cliente. RLS decide qué ve cada rol. */

export async function listarCuentas(busqueda: string) {
  const supabase = await createClient();
  let query = supabase
    .from("cuentas")
    .select(
      "id, nombre, tipo_industria, plantas (id, nombre, municipio, estado, deleted_at)",
    )
    .is("deleted_at", null)
    .order("nombre");
  // Se quitan los comodines para que la búsqueda sea texto literal.
  const texto = busqueda.replace(/[%_\\]/g, "").trim();
  if (texto) query = query.ilike("nombre", `%${texto}%`);

  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar los clientes.");
  return data.map((c) => ({
    ...c,
    plantas: c.plantas.filter((p) => p.deleted_at === null),
  }));
}

export async function obtenerCuenta(id: string) {
  const supabase = await createClient();
  const [cuenta, plantas, razones, contactos] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre, tipo_industria, notas")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("plantas")
      .select(
        "id, nombre, calle, numero_exterior, numero_interior, colonia, municipio, estado, codigo_postal, referencia, razon_social_id",
      )
      .eq("cuenta_id", id)
      .is("deleted_at", null)
      .order("nombre"),
    supabase
      .from("razones_sociales")
      .select(
        "id, razon_social, rfc, regimen_fiscal, codigo_postal_fiscal, uso_cfdi, usa_portal_proveedores, notas",
      )
      .eq("cuenta_id", id)
      .is("deleted_at", null)
      .order("razon_social"),
    supabase
      .from("contactos")
      .select(
        "id, nombre, area, puesto, planta_id, telefono_celular, telefono_oficina, correo, recibe_facturas, recibe_informes, notas",
      )
      .eq("cuenta_id", id)
      .is("deleted_at", null)
      .order("nombre"),
  ]);
  if (cuenta.error || plantas.error || razones.error || contactos.error) {
    throw new Error("No se pudo cargar el cliente.");
  }
  if (!cuenta.data) return null;

  return {
    ...cuenta.data,
    plantas: plantas.data,
    razonesSociales: razones.data,
    contactos: contactos.data,
  };
}

export type CuentaCompleta = NonNullable<
  Awaited<ReturnType<typeof obtenerCuenta>>
>;
