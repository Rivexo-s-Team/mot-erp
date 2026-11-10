import { z } from "zod";

/**
 * Definición de los catálogos base. Las pantallas de lista y edición se arman
 * a partir de esto, así los cinco catálogos se ven y se comportan igual.
 */

export type Opcion = { value: string; label: string };

export type Campo = {
  name: string;
  label: string;
  tipo: "texto" | "numero" | "entero" | "opciones" | "casilla";
  opcional?: boolean;
  opciones?: Opcion[];
  ayuda?: string;
  /** No se puede cambiar después de crear el registro. */
  soloAlCrear?: boolean;
};

export type Fila = Record<string, string | number | boolean | null>;
export type Valores = Record<string, string | boolean>;

export type Columna = { titulo: string; valor: (fila: Fila) => string };

export type TablaCatalogo =
  "aceites" | "partes" | "actividades" | "fallas" | "parametros_laboratorio";

export type Catalogo = {
  slug: string;
  tabla: TablaCatalogo;
  titulo: string;
  singular: string;
  descripcion: string;
  permisoEditar: string;
  ordenarPor: string[];
  /** Texto principal de cada fila (título en la vista de celular). */
  nombre: (fila: Fila) => string;
  columnas: Columna[];
  campos: Campo[];
  /** Validación entre campos. Devuelve el campo con error y el mensaje. */
  validar?: (valores: Valores) => { campo: string; mensaje: string } | null;
};

type Valor = Fila[string] | undefined;

const texto = (v: Valor) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

const GRUPOS: Opcion[] = [
  { value: "fisicoquimico", label: "Fisicoquímico" },
  { value: "desgaste", label: "Desgaste" },
  { value: "aditivos", label: "Aditivos" },
  { value: "contaminantes", label: "Contaminantes" },
  { value: "cualitativo", label: "Cualitativo" },
];

const REGLAS: Opcion[] = [
  { value: "sin_limite", label: "Sin límite (solo se reporta)" },
  { value: "maximo", label: "Máximo (valor menor que el límite)" },
  { value: "minimo", label: "Mínimo (valor mayor que el límite)" },
  { value: "codigo_iso", label: "Código ISO 4406 máximo" },
  { value: "nominal_pct", label: "Nominal del aceite ± %" },
  { value: "linea_base_abs", label: "Muestra virgen ± valor" },
  { value: "linea_base_pct", label: "Muestra virgen ± %" },
];

const BASES: Opcion[] = [
  { value: "usado_vs_tratado", label: "Usado contra tratado" },
  { value: "virgen_vs_tratado", label: "Virgen contra tratado" },
  { value: "valor_teorico", label: "Valor teórico" },
];

const TIPOS_PARTE: Opcion[] = [
  { value: "parte", label: "Parte" },
  { value: "accesorio", label: "Accesorio" },
];

const etiqueta = (opciones: Opcion[], v: Valor) =>
  opciones.find((o) => o.value === v)?.label ?? texto(v);

/** Límite de un parámetro de laboratorio como se lee en el informe. */
export function describirLimite(fila: Fila): string {
  const n = fila.limite_valor;
  switch (fila.tipo_regla) {
    case "maximo":
      return `< ${n}`;
    case "minimo":
      return `> ${n}`;
    case "codigo_iso":
      return texto(fila.limite_texto);
    case "nominal_pct":
      return `Nominal ± ${n} %`;
    case "linea_base_abs":
      return `Virgen ± ${n}`;
    case "linea_base_pct":
      return `Virgen ± ${n} %`;
    default:
      return "—";
  }
}

const campoOrden: Campo = {
  name: "orden",
  label: "Orden en las listas",
  tipo: "entero",
  ayuda: "Los números menores aparecen primero.",
};
const campoActivo: Campo = {
  name: "activo",
  label: "Activo (se puede elegir)",
  tipo: "casilla",
};

export const CATALOGOS: Catalogo[] = [
  {
    slug: "aceites",
    tabla: "aceites",
    titulo: "Aceites",
    singular: "aceite",
    descripcion:
      "Marca, grado ISO y viscosidad nominal. Base de los límites de laboratorio.",
    permisoEditar: "catalogos_laboratorio.editar",
    ordenarPor: ["marca", "nombre_comercial"],
    nombre: (f) => `${f.marca} ${f.nombre_comercial}`,
    columnas: [
      { titulo: "Marca", valor: (f) => texto(f.marca) },
      { titulo: "Nombre comercial", valor: (f) => texto(f.nombre_comercial) },
      { titulo: "Grado ISO VG", valor: (f) => texto(f.grado_iso_vg) },
      {
        titulo: "Viscosidad a 40 °C",
        valor: (f) =>
          f.viscosidad_nominal_40c === null
            ? "—"
            : `${f.viscosidad_nominal_40c} cSt`,
      },
    ],
    campos: [
      { name: "marca", label: "Marca", tipo: "texto" },
      { name: "nombre_comercial", label: "Nombre comercial", tipo: "texto" },
      {
        name: "grado_iso_vg",
        label: "Grado ISO VG",
        tipo: "entero",
        opcional: true,
      },
      {
        name: "viscosidad_nominal_40c",
        label: "Viscosidad nominal a 40 °C (cSt)",
        tipo: "numero",
        opcional: true,
        ayuda:
          "El límite de viscosidad del laboratorio se calcula con este valor.",
      },
      campoActivo,
    ],
  },
  {
    slug: "parametros-laboratorio",
    tabla: "parametros_laboratorio",
    titulo: "Parámetros de laboratorio",
    singular: "parámetro",
    descripcion:
      "Lo que mide el laboratorio y el límite con que se evalúa cada resultado.",
    permisoEditar: "catalogos_laboratorio.editar",
    ordenarPor: ["orden", "nombre"],
    nombre: (f) => texto(f.nombre),
    columnas: [
      { titulo: "Parámetro", valor: (f) => texto(f.nombre) },
      { titulo: "Grupo", valor: (f) => etiqueta(GRUPOS, f.grupo) },
      { titulo: "Unidad", valor: (f) => texto(f.unidad) },
      { titulo: "Límite", valor: describirLimite },
      { titulo: "Método", valor: (f) => texto(f.metodo) },
    ],
    campos: [
      {
        name: "clave",
        label: "Clave",
        tipo: "texto",
        soloAlCrear: true,
        ayuda:
          "Identificador corto en minúsculas, sin espacios. Ejemplo: viscosidad_40c.",
      },
      { name: "nombre", label: "Nombre", tipo: "texto" },
      { name: "grupo", label: "Grupo", tipo: "opciones", opciones: GRUPOS },
      { name: "unidad", label: "Unidad", tipo: "texto", opcional: true },
      {
        name: "metodo",
        label: "Método o norma",
        tipo: "texto",
        opcional: true,
      },
      {
        name: "tipo_regla",
        label: "Tipo de límite",
        tipo: "opciones",
        opciones: REGLAS,
      },
      {
        name: "limite_valor",
        label: "Valor del límite",
        tipo: "numero",
        opcional: true,
        ayuda:
          "Número del límite o del ± permitido. Vacío si es sin límite o código ISO.",
      },
      {
        name: "limite_texto",
        label: "Código ISO límite",
        tipo: "texto",
        opcional: true,
        ayuda: "Solo para código ISO. Ejemplo: 18/16/13.",
      },
      {
        name: "base_comparacion",
        label: "Desviación contra",
        tipo: "opciones",
        opciones: BASES,
        opcional: true,
      },
      campoOrden,
      campoActivo,
    ],
    validar: (v) => {
      const valor = String(v.limite_valor ?? "").trim();
      const codigo = String(v.limite_texto ?? "").trim();
      if (!/^[a-z][a-z0-9_]*$/.test(String(v.clave ?? ""))) {
        return {
          campo: "clave",
          mensaje: "Solo minúsculas, números y guion bajo.",
        };
      }
      if (v.tipo_regla === "sin_limite") {
        if (valor)
          return {
            campo: "limite_valor",
            mensaje: "Déjalo vacío: este parámetro no tiene límite.",
          };
        if (codigo)
          return {
            campo: "limite_texto",
            mensaje: "Déjalo vacío: este parámetro no tiene límite.",
          };
        return null;
      }
      if (v.tipo_regla === "codigo_iso") {
        if (!/^\d{1,2}\/\d{1,2}\/\d{1,2}$/.test(codigo)) {
          return {
            campo: "limite_texto",
            mensaje: "Escribe el código como 18/16/13.",
          };
        }
        if (valor)
          return {
            campo: "limite_valor",
            mensaje: "Déjalo vacío: el límite es el código ISO.",
          };
        return null;
      }
      if (!valor)
        return {
          campo: "limite_valor",
          mensaje: "Escribe el valor del límite.",
        };
      if (codigo)
        return {
          campo: "limite_texto",
          mensaje: "Déjalo vacío: solo aplica a código ISO.",
        };
      return null;
    },
  },
  {
    slug: "partes",
    tabla: "partes",
    titulo: "Partes y accesorios",
    singular: "parte",
    descripcion: "Lo que se cambia o se instala en una orden de servicio.",
    permisoEditar: "catalogos_partes.editar",
    ordenarPor: ["orden", "nombre"],
    nombre: (f) => texto(f.nombre),
    columnas: [
      { titulo: "Nombre", valor: (f) => texto(f.nombre) },
      { titulo: "Tipo", valor: (f) => etiqueta(TIPOS_PARTE, f.tipo) },
      { titulo: "Notas", valor: (f) => texto(f.notas) },
    ],
    campos: [
      { name: "nombre", label: "Nombre", tipo: "texto" },
      { name: "tipo", label: "Tipo", tipo: "opciones", opciones: TIPOS_PARTE },
      { name: "notas", label: "Notas", tipo: "texto", opcional: true },
      campoOrden,
      campoActivo,
    ],
  },
  {
    slug: "actividades",
    tabla: "actividades",
    titulo: "Actividades",
    singular: "actividad",
    descripcion: "Lo que se hace en una visita de servicio.",
    permisoEditar: "catalogos_operacion.editar",
    ordenarPor: ["orden", "nombre"],
    nombre: (f) => texto(f.nombre),
    columnas: [{ titulo: "Nombre", valor: (f) => texto(f.nombre) }],
    campos: [
      { name: "nombre", label: "Nombre", tipo: "texto" },
      campoOrden,
      campoActivo,
    ],
  },
  {
    slug: "fallas",
    tabla: "fallas",
    titulo: "Fallas",
    singular: "falla",
    descripcion: "Problemas que se reportan en una orden de servicio.",
    permisoEditar: "catalogos_operacion.editar",
    ordenarPor: ["orden", "nombre"],
    nombre: (f) => texto(f.nombre),
    columnas: [
      { titulo: "Nombre", valor: (f) => texto(f.nombre) },
      {
        titulo: "Cargo al cliente",
        valor: (f) => (f.permite_cargo_cliente ? "Sí" : "No"),
      },
    ],
    campos: [
      { name: "nombre", label: "Nombre", tipo: "texto" },
      {
        name: "permite_cargo_cliente",
        label: "Permite cargo al cliente (daño por mal uso)",
        tipo: "casilla",
      },
      campoOrden,
      campoActivo,
    ],
  },
];

export function getCatalogo(slug: string): Catalogo | undefined {
  return CATALOGOS.find((c) => c.slug === slug);
}

/** Valores del formulario a partir de una fila (o los de un registro nuevo). */
export function valoresIniciales(catalogo: Catalogo, fila?: Fila): Valores {
  const valores: Valores = {};
  for (const campo of catalogo.campos) {
    const v = fila?.[campo.name];
    if (campo.tipo === "casilla") {
      valores[campo.name] = fila ? Boolean(v) : campo.name === "activo";
    } else if (campo.name === "orden") {
      valores[campo.name] = fila ? String(v ?? 0) : "0";
    } else {
      valores[campo.name] = v === null || v === undefined ? "" : String(v);
    }
  }
  return valores;
}

/** Esquema Zod del formulario; se usa igual en el navegador y en el servidor. */
export function esquemaCatalogo(catalogo: Catalogo) {
  const shape: Record<string, z.ZodType<string | boolean>> = {};
  for (const campo of catalogo.campos) {
    if (campo.tipo === "casilla") {
      shape[campo.name] = z.boolean();
      continue;
    }
    let s = z.string().trim().max(200, "Máximo 200 caracteres.");
    if (!campo.opcional) s = s.min(1, "Este dato es obligatorio.");
    if (campo.tipo === "numero") {
      s = s.regex(/^(\d+(\.\d+)?)?$/, "Escribe un número, por ejemplo 0.5.");
    } else if (campo.tipo === "entero") {
      s = s.regex(/^\d*$/, "Escribe un número entero.");
    } else if (campo.tipo === "opciones") {
      const validos = (campo.opciones ?? []).map((o) => o.value);
      s = s.refine(
        (v) => (v === "" && campo.opcional) || validos.includes(v),
        "Elige una opción.",
      );
    }
    shape[campo.name] = s;
  }
  return z.object(shape).superRefine((valores, ctx) => {
    const problema = catalogo.validar?.(valores);
    if (problema)
      ctx.addIssue({
        code: "custom",
        path: [problema.campo],
        message: problema.mensaje,
      });
  });
}

/** Convierte los valores ya validados a lo que se guarda en la base. */
export function aFila(
  catalogo: Catalogo,
  valores: Valores,
  esEdicion: boolean,
): Fila {
  const fila: Fila = {};
  for (const campo of catalogo.campos) {
    if (esEdicion && campo.soloAlCrear) continue;
    const v = valores[campo.name];
    if (typeof v === "boolean") fila[campo.name] = v;
    else if (v === undefined || v === "")
      fila[campo.name] = campo.name === "orden" ? 0 : null;
    else if (campo.tipo === "numero" || campo.tipo === "entero")
      fila[campo.name] = Number(v);
    else fila[campo.name] = v;
  }
  return fila;
}
