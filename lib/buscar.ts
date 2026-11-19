/** Búsqueda sencilla en listas: sin acentos, sin mayúsculas y por palabras. */

export const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * ¿Lo buscado aparece en alguno de los textos? Cada palabra debe aparecer en
 * algún lado ("rassini 102" encuentra la factura 102 de Rassini). Una búsqueda
 * vacía coincide con todo.
 */
export function coincide(
  busqueda: string,
  textos: (string | number | null | undefined)[],
): boolean {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const pajar = normalizar(textos.filter((t) => t != null).join(" "));
  return palabras.every((p) => pajar.includes(p));
}
