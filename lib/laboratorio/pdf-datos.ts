import { formatDia } from "@/lib/format";
import { CONDICIONES, type ResumenCondicion } from "./evaluacion";
import {
  formatoEje,
  seriesDeTendencia,
  trazar,
  type Caja,
  type Trazo,
} from "./graficas";
import { formatDesviacion, type ContenidoInforme } from "./informe";
import { etiqueta, NIVELES_ANALISIS, TIPOS_MUESTRA } from "./muestras";

/**
 * Lo que aparece en el PDF del informe de laboratorio, con la estructura del
 * informe "Análisis de tendencias en aceites" de MOT (FOLAB). Se arma aparte
 * del dibujo para poder probarlo. Sale del contenido del informe: si está
 * validado, de su copia fija.
 */

/** Columnas de muestras que caben en una hoja carta horizontal. */
export const MAX_MUESTRAS_PDF = 8;

/** Notas al pie de las tablas, tal como las trae el informe de MOT. */
export const NOTAS_INFORME = {
  fisicoquimico:
    "Los análisis se efectuaron siguiendo los lineamientos de diversos estándares internacionales ISO y ASTM (4406:99 para conteo de partículas, D445 para viscosidad, D6304 para agua o ASTM E2412 por espectroscopia de infrarrojo, D664 para TAN, D7843 para residuo de filtración MPC y E2412 para infrarrojo por transformada de Fourier). Todos los métodos de cuantificación efectuados constituyen pruebas no destructivas que no requieren de preparación de la muestra previo al análisis (aceite al 100 % de la composición original al momento del muestreo). La desviación presentada corresponde a: 1) en conteo de partículas, residuos de filtración y viscosidades, la diferencia entre el aceite usado y el tratado; 2) en TAN y oxidación, la diferencia entre el aceite línea base (virgen) y el tratado.",
  elementos:
    "Las lecturas están efectuadas bajo el método de parámetros fundamentales por fluorescencia de rayos X de energía dispersiva y la ASTM D6481, con rango de medición de hasta arriba de 5 micrómetros. La desviación presentada corresponde a: 1) en elementos de desgaste y contaminantes, la diferencia entre el aceite usado y el tratado; 2) en aditivos, la diferencia entre el aceite línea base (virgen) y el tratado.",
} as const;

export type EntradaPdfInforme = {
  informe: {
    folio: string;
    estado: string;
    fecha_emision: string;
    observaciones: string | null;
    recomienda_cambio_filtro: boolean;
    cliente: string | null;
    planta: string | null;
    direccion: string | null;
    elaboro: string | null;
    valido: string | null;
    /** Día en que se validó (aaaa-mm-dd). */
    validado_el: string | null;
  };
  equipo: {
    identificador: string;
    alias: string | null;
    aplicacion: string | null;
    aceite: string | null;
    volumen_reservorio_l: number | null;
  } | null;
  /** ID de caso de la última muestra del informe. */
  idCaso: string | null;
  contenido: ContenidoInforme;
};

type Renglon = { etiqueta: string; valor: string };
type Celda = { texto: string; noPasa: boolean };

export type DatosPdfInforme = {
  nombreArchivo: string;
  folio: string;
  fechaEmision: string;
  sinValidar: boolean;
  condicionGeneral: string | null;
  cliente: Renglon[];
  ultimaMuestra: Renglon[];
  equipo: Renglon[];
  /** Aviso si el informe tiene más muestras de las que caben. */
  avisoMuestras: string | null;
  columnas: string[];
  /** Tipo, fecha, análisis, anotaciones y condiciones de cada muestra. */
  encabezado: { titulo: string; celdas: Celda[]; fuerte: boolean }[];
  grupos: {
    grupo: string;
    titulo: string;
    filas: {
      nombre: string;
      unidad: string;
      celdas: Celda[];
      limite: string;
      desviacion: string;
    }[];
  }[];
  graficas: {
    titulo: string;
    series: {
      nombre: string;
      unidad: string;
      limite: string | null;
      ultimo: string;
      ejeMax: string;
      ejeMin: string;
      trazo: Trazo;
    }[];
    enCero: string[];
  }[];
  /** Fechas de la primera y la última muestra, para el eje de las gráficas. */
  ejeFechas: [string, string] | null;
  observaciones: string | null;
  /** Recomendación del laboratorio que se imprime bajo las observaciones. */
  recomendacion: string | null;
  elaboro: string;
  valido: string;
};

/** Caja de cada gráfica en el PDF (puntos tipográficos). */
export const CAJA_PDF: Caja = {
  // Caben cuatro por renglón en una hoja carta horizontal.
  ancho: 162,
  alto: 78,
  margen: { arriba: 6, derecha: 8, abajo: 12, izquierda: 30 },
};

/** La fuente del PDF no trae la letra delta: "ΔE" se escribe "Delta E". */
const unidadPdf = (u: string | null) => (u ?? "").replaceAll("Δ", "Delta ");

const valor = (v: string | null | undefined) =>
  v && v.trim() !== "" ? v : "No disponible";

const condicion = (r: ResumenCondicion | null): Celda => ({
  texto: r ? CONDICIONES[r.condicion] : "—",
  noPasa: r?.condicion === "critico",
});

const fechaCorta = (dia: string) => {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a?.slice(2)}`;
};

export function datosInformePdf(e: EntradaPdfInforme): DatosPdfInforme {
  const { informe, equipo, contenido } = e;
  const total = contenido.muestras.length;
  // Si no caben todas, se imprimen las más recientes.
  const desde = Math.max(0, total - MAX_MUESTRAS_PDF);
  const muestras = contenido.muestras.slice(desde);
  const ultima = muestras.at(-1);
  const celda = (texto: string): Celda => ({ texto, noPasa: false });

  const recortado: ContenidoInforme = {
    ...contenido,
    muestras,
    grupos: contenido.grupos.map((g) => ({
      ...g,
      filas: g.filas.map((f) => ({ ...f, valores: f.valores.slice(desde) })),
    })),
  };

  return {
    nombreArchivo: `Informe_${informe.folio.replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`,
    folio: informe.folio,
    fechaEmision: formatDia(informe.fecha_emision),
    sinValidar: informe.estado !== "validado",
    condicionGeneral: contenido.condicionGeneral
      ? CONDICIONES[contenido.condicionGeneral]
      : null,
    cliente: [
      { etiqueta: "ID de caso", valor: valor(e.idCaso) },
      {
        etiqueta: "Compañía",
        valor: valor(
          [informe.cliente, informe.planta].filter(Boolean).join(" "),
        ),
      },
      { etiqueta: "Dirección", valor: valor(informe.direccion) },
    ],
    ultimaMuestra: [
      { etiqueta: "ID de muestra", valor: valor(ultima?.idMuestra) },
      {
        etiqueta: "Tipo de servicio",
        valor: valor(ultima?.nivel && etiqueta(NIVELES_ANALISIS, ultima.nivel)),
      },
      {
        etiqueta: "Fecha de muestreo",
        valor: ultima ? formatDia(ultima.fecha) : "No disponible",
      },
    ],
    equipo: [
      {
        etiqueta: "Identificado como",
        valor: valor(
          equipo &&
            `${equipo.identificador}${equipo.alias ? ` (${equipo.alias})` : ""}`,
        ),
      },
      { etiqueta: "Proceso / área", valor: valor(equipo?.aplicacion) },
      { etiqueta: "Aceite", valor: valor(equipo?.aceite) },
      {
        etiqueta: "Capacidad",
        valor:
          equipo?.volumen_reservorio_l != null
            ? `${equipo.volumen_reservorio_l} L`
            : "No disponible",
      },
    ],
    avisoMuestras:
      desde > 0
        ? `El informe tiene ${total} muestras; se imprimen las ${MAX_MUESTRAS_PDF} más recientes.`
        : null,
    columnas: muestras.map((m) => m.idMuestra),
    encabezado: [
      {
        titulo: "Tipo de muestra",
        celdas: muestras.map((m) => celda(etiqueta(TIPOS_MUESTRA, m.tipo))),
        fuerte: false,
      },
      {
        titulo: "Fecha de muestreo",
        celdas: muestras.map((m) => celda(formatDia(m.fecha))),
        fuerte: false,
      },
      {
        titulo: "Análisis",
        celdas: muestras.map((m) =>
          celda(m.nivel ? etiqueta(NIVELES_ANALISIS, m.nivel) : "—"),
        ),
        fuerte: false,
      },
      {
        titulo: "Anotaciones",
        celdas: muestras.map((m) => celda(m.notas ?? "—")),
        fuerte: false,
      },
      {
        titulo: "Condición del aceite",
        celdas: muestras.map((m) => condicion(m.aceite)),
        fuerte: true,
      },
      {
        titulo: "Condición de aditivos",
        celdas: muestras.map((m) => condicion(m.aditivos)),
        fuerte: true,
      },
    ],
    grupos: recortado.grupos.map((g) => ({
      grupo: g.grupo,
      titulo: g.titulo,
      filas: g.filas.map((f) => ({
        nombre: f.nombre,
        unidad: unidadPdf(f.unidad),
        celdas: f.valores.map((v): Celda =>
          v
            ? { texto: v.texto, noPasa: v.veredicto === "no_pasa" }
            : celda("—"),
        ),
        limite: f.limite ?? "—",
        desviacion: formatDesviacion(f.desviacion) || "—",
      })),
    })),
    graficas: seriesDeTendencia(recortado).map((g) => ({
      titulo: g.titulo,
      enCero: g.enCero,
      series: g.series.map((s) => {
        const trazo = trazar(s, muestras.length, CAJA_PDF);
        return {
          nombre: s.nombre,
          unidad: unidadPdf(s.unidad),
          limite: s.limite,
          ultimo: s.puntos.at(-1)?.texto ?? "",
          ejeMax: formatoEje(trazo.escala.max),
          ejeMin: formatoEje(trazo.escala.min),
          trazo,
        };
      }),
    })),
    ejeFechas:
      muestras[0] && ultima && muestras.length > 1
        ? [fechaCorta(muestras[0].fecha), fechaCorta(ultima.fecha)]
        : null,
    observaciones: informe.observaciones?.trim() || null,
    recomendacion: informe.recomienda_cambio_filtro
      ? "Se recomienda cambiar el filtro del RecondOil Box."
      : null,
    elaboro: informe.elaboro ?? "—",
    valido:
      informe.estado === "validado" && informe.valido
        ? `${informe.valido}${informe.validado_el ? ` · ${formatDia(informe.validado_el)}` : ""}`
        : "Sin validar",
  };
}
