import { z } from "zod";

/**
 * Lo que el técnico captura en la visita (DISENO §4.4): datos del equipo,
 * lecturas del Robox, actividades y fallas. Este archivo no toca la base ni
 * el navegador: lo usan igual el formulario del celular y el servidor.
 */

export type CampoLectura = {
  name: string;
  label: string;
  unidad?: string;
  tipo: "texto" | "entero" | "numero";
};

/** Los renglones de "Parámetros ROBX" del formato, en su mismo orden. */
export const CAMPOS_LECTURA: CampoLectura[] = [
  { name: "modelo", label: "Modelo", tipo: "texto" },
  { name: "numero_serie", label: "No. de serie", tipo: "texto" },
  { name: "programa", label: "Programa", tipo: "texto" },
  { name: "presion_filtro", label: "Presión / Filtro", tipo: "texto" },
  {
    name: "filter_used_dias",
    label: "Filter used",
    unidad: "días",
    tipo: "entero",
  },
  {
    name: "filter_lifetime_dias",
    label: "Filter lifetime",
    unidad: "días",
    tipo: "entero",
  },
  { name: "runtime_dias", label: "Runtime", unidad: "días", tipo: "entero" },
  { name: "ack_flow_l", label: "Ack. flow", unidad: "litros", tipo: "numero" },
  { name: "presion_bar", label: "Presión", unidad: "bar", tipo: "numero" },
  { name: "flujo_l_min", label: "Flujo", unidad: "L/min", tipo: "numero" },
  { name: "temperatura_c", label: "Temperatura", unidad: "°C", tipo: "numero" },
];

export const MOMENTOS = ["inicial", "posterior"] as const;
export type Momento = (typeof MOMENTOS)[number];

/** Una lectura: cada renglón como texto, tal como se escribe ("" = sin dato). */
export type Lectura = Record<string, string>;

export const ROLES_FIRMA = ["tecnico", "cliente"] as const;
export type RolFirma = (typeof ROLES_FIRMA)[number];

/** Tamaño del lienzo donde se dibuja la firma; los trazos usan estas coordenadas. */
export const LIENZO_FIRMA = { ancho: 600, alto: 240 };

/**
 * Una firma dibujada. Cada trazo es una lista [x1, y1, x2, y2, …] de puntos
 * enteros dentro del lienzo. Sin trazos = sin firmar.
 */
export type Firma = {
  nombre: string;
  cargo: string;
  /** Día en que se firmó (aaaa-mm-dd). */
  fecha: string;
  trazos: number[][];
};

export const firmaVacia = (): Firma => ({
  nombre: "",
  cargo: "",
  fecha: "",
  trazos: [],
});

export const estaFirmada = (f: Firma) => f.trazos.length > 0;

/** Puntos de un trazo ([x1, y1, x2, y2, …]) como los pide un polyline: "x1,y1 x2,y2". */
export function puntosDeTrazo(trazo: number[]): string {
  const pares: string[] = [];
  for (let i = 0; i + 1 < trazo.length; i += 2)
    pares.push(`${trazo[i]},${trazo[i + 1]}`);
  // Un toque sin arrastre se dibuja como un punto.
  if (pares.length === 1 && pares[0]) pares.push(pares[0]);
  return pares.join(" ");
}

/** La captura completa, en la forma que maneja el formulario. */
export type Captura = {
  id_caso: string;
  temperatura_aceite_c: string;
  volumen_reservorio_l: string;
  observaciones: string;
  lecturas: Record<Momento, Lectura>;
  /** Actividad marcada → cantidad escrita ("" si no lleva). */
  actividades: Record<string, string>;
  fallas: string[];
  /** Parte o accesorio usado → cantidad escrita. */
  partes: Record<string, string>;
  firmas: Record<RolFirma, Firma>;
};

export const lecturaVacia = (): Lectura =>
  Object.fromEntries(CAMPOS_LECTURA.map((c) => [c.name, ""]));

export const capturaVacia = (): Captura => ({
  id_caso: "",
  temperatura_aceite_c: "",
  volumen_reservorio_l: "",
  observaciones: "",
  lecturas: { inicial: lecturaVacia(), posterior: lecturaVacia() },
  actividades: {},
  fallas: [],
  partes: {},
  firmas: { tecnico: firmaVacia(), cliente: firmaVacia() },
});

const numero = z
  .string()
  .trim()
  .max(20)
  .regex(/^(\d+(\.\d+)?)?$/, "Escribe un número, por ejemplo 3.51.");
const entero = z
  .string()
  .trim()
  .max(9)
  .regex(/^\d*$/, "Escribe un número entero.");
const texto = z.string().trim().max(60, "Máximo 60 caracteres.");

const esquemaLectura = z.object(
  Object.fromEntries(
    CAMPOS_LECTURA.map((c) => [
      c.name,
      c.tipo === "numero" ? numero : c.tipo === "entero" ? entero : texto,
    ]),
  ),
);

const esquemaFirma = z
  .object({
    nombre: z.string().trim().max(120, "Máximo 120 caracteres."),
    cargo: z.string().trim().max(80, "Máximo 80 caracteres."),
    fecha: z
      .string()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/, "La fecha de la firma no es válida."),
    trazos: z
      .array(
        z
          .array(z.number().int().min(0).max(LIENZO_FIRMA.ancho))
          .min(2)
          .max(4000)
          .refine((t) => t.length % 2 === 0),
      )
      .max(300, "La firma tiene demasiados trazos. Bórrala y firma de nuevo."),
  })
  .refine((f) => f.trazos.length === 0 || f.nombre !== "", {
    path: ["nombre"],
    message: "Escribe el nombre de quien firma.",
  });

export const esquemaCaptura = z.object({
  id_caso: z.string().trim().max(40, "Máximo 40 caracteres."),
  temperatura_aceite_c: numero,
  volumen_reservorio_l: numero.refine(
    (v) => v === "" || Number(v) > 0,
    "Debe ser mayor que cero.",
  ),
  observaciones: z.string().trim().max(2000, "Máximo 2000 caracteres."),
  lecturas: z.object({ inicial: esquemaLectura, posterior: esquemaLectura }),
  actividades: z.record(
    z.uuid(),
    entero.refine((v) => v === "" || Number(v) > 0, "Debe ser mayor que cero."),
  ),
  fallas: z.array(z.uuid()).max(100),
  partes: z.record(
    z.uuid(),
    numero
      .min(1, "Escribe cuántas se usaron.")
      .refine((v) => v === "" || Number(v) > 0, "Debe ser mayor que cero."),
  ),
  firmas: z.object({ tecnico: esquemaFirma, cliente: esquemaFirma }),
});

/** Primer problema de la captura, con el lugar donde está, o null si está bien. */
export function problemaCaptura(
  captura: Captura,
): { ruta: string; mensaje: string } | null {
  const r = esquemaCaptura.safeParse(captura);
  if (r.success) return null;
  const issue = r.error.issues[0];
  return {
    ruta: (issue?.path ?? []).join("."),
    mensaje: issue?.message ?? "Revisa los datos.",
  };
}

/** Lo que recibe la función guardar_captura_orden() de la base. */
export function aCargaUtil(captura: Captura) {
  const c = esquemaCaptura.parse(captura);
  return {
    id_caso: c.id_caso,
    temperatura_aceite_c: c.temperatura_aceite_c,
    volumen_reservorio_l: c.volumen_reservorio_l,
    observaciones: c.observaciones,
    lecturas: c.lecturas,
    actividades: Object.entries(c.actividades).map(([id, cantidad]) => ({
      id,
      cantidad,
    })),
    fallas: [...new Set(c.fallas)],
    partes: Object.entries(c.partes).map(([id, cantidad]) => ({
      id,
      cantidad,
    })),
    firmas: c.firmas,
  };
}

export const lecturaTieneDatos = (l: Lectura) =>
  Object.values(l).some((v) => v.trim() !== "");

/** Cuánto lleva capturado, para el resumen de la orden. */
export function resumenCaptura(c: Captura) {
  return {
    inicial: lecturaTieneDatos(c.lecturas.inicial),
    posterior: lecturaTieneDatos(c.lecturas.posterior),
    actividades: Object.keys(c.actividades).length,
    fallas: c.fallas.length,
    partes: Object.keys(c.partes).length,
    firmaTecnico: estaFirmada(c.firmas.tecnico),
    firmaCliente: estaFirmada(c.firmas.cliente),
  };
}

/**
 * Lo que falta para poder cerrar la orden: siempre firma el técnico y, en una
 * visita, también el responsable del cliente. Lista vacía = se puede cerrar.
 */
export function faltantesParaCerrar(
  c: Captura,
  tipo: "visita" | "taller" | string,
): string[] {
  const faltan: string[] = [];
  if (!estaFirmada(c.firmas.tecnico)) faltan.push("la firma del técnico");
  if (tipo === "visita" && !estaFirmada(c.firmas.cliente))
    faltan.push("la firma del responsable del cliente");
  return faltan;
}

// Borrador en el teléfono -------------------------------------------------------

/** Lo que se guarda en el teléfono mientras se captura. */
export type Borrador = {
  captura: Captura;
  /** Verdadero si hay cambios que todavía no llegan al sistema. */
  pendiente: boolean;
  /** Cuándo se guardó en el teléfono (ISO). */
  guardado: string;
};

export const claveBorrador = (ordenId: string) => `mot:captura:${ordenId}`;

/** Lee un borrador guardado; si está dañado o es de otra versión, lo ignora. */
export function leerBorrador(texto: string | null): Borrador | null {
  if (!texto) return null;
  try {
    const b = JSON.parse(texto) as Partial<Borrador>;
    if (typeof b.pendiente !== "boolean" || typeof b.guardado !== "string")
      return null;
    const base = capturaVacia();
    const c = (b.captura ?? {}) as Partial<Captura>;
    // Se completa con vacíos por si el borrador viene de una versión anterior.
    const captura: Captura = {
      ...base,
      ...c,
      lecturas: {
        inicial: { ...base.lecturas.inicial, ...c.lecturas?.inicial },
        posterior: { ...base.lecturas.posterior, ...c.lecturas?.posterior },
      },
      actividades: { ...c.actividades },
      fallas: [...(c.fallas ?? [])],
      partes: { ...c.partes },
      firmas: {
        tecnico: { ...base.firmas.tecnico, ...c.firmas?.tecnico },
        cliente: { ...base.firmas.cliente, ...c.firmas?.cliente },
      },
    };
    return { captura, pendiente: b.pendiente, guardado: b.guardado };
  } catch {
    return null;
  }
}

/**
 * Con qué captura arranca el formulario: si en el teléfono hay cambios sin
 * enviar, mandan esos; si no, lo que ya está en el sistema.
 */
export function capturaInicial(
  delSistema: Captura,
  borrador: Borrador | null,
): { captura: Captura; pendiente: boolean } {
  return borrador?.pendiente
    ? { captura: borrador.captura, pendiente: true }
    : { captura: delSistema, pendiente: false };
}
