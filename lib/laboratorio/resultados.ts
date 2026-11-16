/**
 * Resultados de laboratorio (DISENO §4.5): cómo se escribe un valor y qué
 * parámetros se piden según el nivel de análisis. Sin base ni navegador.
 */

export const GRUPOS_PARAMETRO = [
  { value: "fisicoquimico", label: "Fisicoquímicos" },
  { value: "desgaste", label: "Elementos de desgaste" },
  { value: "aditivos", label: "Aditivos" },
  { value: "contaminantes", label: "Contaminantes" },
  { value: "cualitativo", label: "Cualitativos" },
] as const;

export type ParametroLab = {
  id: string;
  clave: string;
  nombre: string;
  unidad: string | null;
  grupo: string;
  metodo: string | null;
  tipo_regla: string;
  limite_valor: number | null;
  limite_texto: string | null;
  activo: boolean;
  en_basico: boolean;
  en_basico_mpc: boolean;
  en_extendido: boolean;
  en_premium: boolean;
};

export type ValorInterpretado =
  { ok: true; texto: string } | { ok: false; error: string };

const NUMERO = /^\d+(\.\d+)?$/;
const ISO = /^\d{1,2}\/\d{1,2}\/\d{1,2}$/;
const AYUDA_NUMERO =
  "Escribe un número con punto decimal y sin comas (0.583), con < o > si aplica (<300), o un texto como No detectado.";

/**
 * Revisa lo que escribió el laboratorio y lo deja como se guarda. Vacío es
 * válido: significa que ese parámetro no se midió. El número y su < o > los
 * separa la base a partir de este texto.
 */
export function interpretarValor(
  entrada: string,
  parametro: Pick<ParametroLab, "tipo_regla" | "grupo">,
): ValorInterpretado {
  const texto = entrada.trim().replace(/\s+/g, " ");
  if (texto === "") return { ok: true, texto: "" };
  if (texto.length > 100) return { ok: false, error: "Máximo 100 caracteres." };

  // Los cualitativos (FTIR, colorimetría) son texto libre.
  if (parametro.grupo === "cualitativo") return { ok: true, texto };

  const sinDigitos = !/\d/.test(texto);
  if (parametro.tipo_regla === "codigo_iso") {
    const iso = texto.replace(/\s/g, "");
    if (ISO.test(iso)) return { ok: true, texto: iso };
    if (sinDigitos) return { ok: true, texto };
    return {
      ok: false,
      error: "Escribe el código como 18/16/13, o un texto como No detectado.",
    };
  }

  const acotado = /^([<>])\s*(.+)$/.exec(texto);
  const numero = acotado ? acotado[2] : texto;
  if (numero !== undefined && NUMERO.test(numero))
    return { ok: true, texto: `${acotado?.[1] ?? ""}${numero}` };
  // Un texto sin números ("No detectado", "N/D") se acepta tal cual.
  if (sinDigitos && !/^[<>]/.test(texto)) return { ok: true, texto };
  return { ok: false, error: AYUDA_NUMERO };
}

const COLUMNA_NIVEL = {
  basico: "en_basico",
  basico_mpc: "en_basico_mpc",
  extendido: "en_extendido",
  premium: "en_premium",
} as const;

/** ¿El nivel de análisis de la muestra pide este parámetro? Sin nivel, todos. */
export function loPideElNivel(p: ParametroLab, nivel: string | null): boolean {
  const columna =
    nivel && nivel in COLUMNA_NIVEL
      ? COLUMNA_NIVEL[nivel as keyof typeof COLUMNA_NIVEL]
      : null;
  return columna ? p[columna] : true;
}

export type GrupoCaptura<P> = {
  grupo: string;
  titulo: string;
  parametros: P[];
};

/**
 * Parámetros a capturar, por grupo y en el orden del catálogo. Un parámetro
 * desactivado solo aparece si la muestra ya tiene resultado de él.
 */
export function gruposDeCaptura<P extends ParametroLab>(
  parametros: P[],
  conResultado: ReadonlySet<string>,
): GrupoCaptura<P>[] {
  const visibles = parametros.filter((p) => p.activo || conResultado.has(p.id));
  return GRUPOS_PARAMETRO.map((g) => ({
    grupo: g.value,
    titulo: g.label,
    parametros: visibles.filter((p) => p.grupo === g.value),
  })).filter((g) => g.parametros.length > 0);
}

/**
 * Valida todo lo capturado. Devuelve lo que se manda a la base
 * ({parametro: texto}, sin vacíos) o el error de cada parámetro.
 */
export function prepararResultados(
  valores: Record<string, string>,
  parametros: ParametroLab[],
):
  | { ok: true; resultados: Record<string, string> }
  | { ok: false; errores: Record<string, string> } {
  const porId = new Map(parametros.map((p) => [p.id, p]));
  const resultados: Record<string, string> = {};
  const errores: Record<string, string> = {};
  for (const [id, entrada] of Object.entries(valores)) {
    const parametro = porId.get(id);
    if (!parametro) {
      if (entrada.trim() !== "") errores[id] = "Ese parámetro ya no existe.";
      continue;
    }
    const r = interpretarValor(entrada, parametro);
    if (!r.ok) errores[id] = r.error;
    else if (r.texto !== "") resultados[id] = r.texto;
  }
  return Object.keys(errores).length > 0
    ? { ok: false, errores }
    : { ok: true, resultados };
}
