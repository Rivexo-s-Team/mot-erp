import { z } from "zod";

/**
 * Formularios definidos como datos: una lista de campos describe qué se
 * captura y cómo se valida. Con eso se arman el formulario en pantalla
 * (components/forms/config-form.tsx) y la validación en el servidor, iguales.
 */

export type Opcion = { value: string; label: string };

export type Campo = {
  name: string;
  label: string;
  tipo:
    | "texto"
    | "textoLargo"
    | "correo"
    | "telefono"
    /** Día del calendario (aaaa-mm-dd), sin hora. */
    | "fecha"
    | "numero"
    | "entero"
    | "opciones"
    /** Selección de otro registro (su id). Las opciones se cargan de la base. */
    | "referencia"
    | "casilla";
  opcional?: boolean;
  opciones?: Opcion[];
  ayuda?: string;
  /** No se puede cambiar después de crear el registro. */
  soloAlCrear?: boolean;
  /** Expresión regular (como texto) que debe cumplir el valor. */
  patron?: string;
  mensajePatron?: string;
  /** Guarda el texto en mayúsculas (RFC, claves). */
  mayusculas?: boolean;
  max?: number;
  /** Valor de una casilla en un registro nuevo. */
  inicial?: boolean;
  /** Valor de un campo de texto u opciones en un registro nuevo. */
  valorInicial?: string;
};

export type Fila = Record<string, string | number | boolean | null>;
export type Valores = Record<string, string | boolean>;
export type ProblemaCampo = { campo: string; mensaje: string };
export type Validador = (valores: Valores) => ProblemaCampo | null;

/** Valores del formulario a partir de una fila (o los de un registro nuevo). */
export function valoresIniciales(campos: Campo[], fila?: Fila): Valores {
  const valores: Valores = {};
  for (const campo of campos) {
    const v = fila?.[campo.name];
    if (campo.tipo === "casilla") {
      valores[campo.name] = fila ? Boolean(v) : (campo.inicial ?? false);
    } else if (campo.name === "orden") {
      valores[campo.name] = fila ? String(v ?? 0) : "0";
    } else {
      valores[campo.name] =
        v === null || v === undefined
          ? fila
            ? ""
            : (campo.valorInicial ?? "")
          : String(v);
    }
  }
  return valores;
}

/** Esquema Zod del formulario; se usa igual en el navegador y en el servidor. */
export function esquemaCampos(campos: Campo[], validar?: Validador) {
  const shape: Record<string, z.ZodType<string | boolean>> = {};
  for (const campo of campos) {
    if (campo.tipo === "casilla") {
      shape[campo.name] = z.boolean();
      continue;
    }
    const max = campo.max ?? (campo.tipo === "textoLargo" ? 2000 : 200);
    let s = z.string().trim().max(max, `Máximo ${max} caracteres.`);
    if (!campo.opcional) s = s.min(1, "Este dato es obligatorio.");

    const vacioO = (ok: (v: string) => boolean) => (v: string) =>
      v === "" || ok(v);
    if (campo.tipo === "numero") {
      s = s.regex(/^(\d+(\.\d+)?)?$/, "Escribe un número, por ejemplo 0.5.");
    } else if (campo.tipo === "entero") {
      s = s.regex(/^\d*$/, "Escribe un número entero.");
    } else if (campo.tipo === "correo") {
      s = s.refine(
        vacioO((v) => z.email().safeParse(v).success),
        "Escribe un correo válido.",
      );
    } else if (campo.tipo === "fecha") {
      s = s.refine(
        vacioO(
          (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)),
        ),
        "Elige una fecha válida.",
      );
    } else if (campo.tipo === "telefono") {
      s = s.regex(/^[0-9+() .-]*$/, "Solo números y los signos + ( ) - .");
    } else if (campo.tipo === "referencia") {
      s = s.refine(
        vacioO((v) => z.uuid().safeParse(v).success),
        "Elige una opción.",
      );
    } else if (campo.tipo === "opciones") {
      const validos = (campo.opciones ?? []).map((o) => o.value);
      s = s.refine(
        vacioO((v) => validos.includes(v)),
        "Elige una opción.",
      );
    }
    if (campo.patron) {
      const patron = new RegExp(campo.patron);
      const normalizar = (v: string) =>
        campo.mayusculas ? v.toUpperCase() : v;
      s = s.refine(
        vacioO((v) => patron.test(normalizar(v))),
        campo.mensajePatron ?? "El formato no es válido.",
      );
    }
    shape[campo.name] = s;
  }
  return z.object(shape).superRefine((valores, ctx) => {
    const problema = validar?.(valores);
    if (problema) {
      ctx.addIssue({
        code: "custom",
        path: [problema.campo],
        message: problema.mensaje,
      });
    }
  });
}

/** Convierte los valores ya validados a lo que se guarda en la base. */
export function aFila(
  campos: Campo[],
  valores: Valores,
  esEdicion: boolean,
): Fila {
  const fila: Fila = {};
  for (const campo of campos) {
    if (esEdicion && campo.soloAlCrear) continue;
    const v = valores[campo.name];
    if (typeof v === "boolean") fila[campo.name] = v;
    else if (v === undefined || v === "")
      fila[campo.name] = campo.name === "orden" ? 0 : null;
    else if (campo.tipo === "numero" || campo.tipo === "entero")
      fila[campo.name] = Number(v);
    else fila[campo.name] = campo.mayusculas ? v.toUpperCase() : v;
  }
  return fila;
}
