import { formatDia } from "@/lib/format";
import { etiqueta, TIPOS_ORDEN } from "./campos";
import {
  CAMPOS_LECTURA,
  estaFirmada,
  puntosDeTrazo,
  type Captura,
} from "./captura";

/**
 * Lo que aparece en el PDF de la orden de servicio, con la estructura del
 * formato en papel "Servicio RecondOil Box". Se arma aparte del dibujo para
 * poder probarlo y para dejar claro qué NO sale: las notas internas con las
 * que se programó la orden (solo salen las "Otros / Notas" de la visita).
 */

export type EntradaPdfOrden = {
  orden: {
    folio: string;
    tipo: string;
    estado: string;
    fecha_programada: string;
    fecha_real: string | null;
    cliente: string | null;
    planta: string | null;
    /** Dirección de la planta en una línea, si está capturada. */
    direccion: string | null;
    robox: string | null;
    tecnico: string;
    acompanante: string | null;
  };
  equipo: {
    identificador: string;
    alias: string | null;
    aplicacion: string | null;
    aceite: string | null;
  } | null;
  captura: Captura;
  actividades: { id: string; nombre: string }[];
  fallas: { id: string; nombre: string }[];
};

type Renglon = { etiqueta: string; valor: string };

export type DatosPdfOrden = {
  folio: string;
  nombreArchivo: string;
  tipo: string;
  /** Verdadero mientras la orden no esté cerrada: el PDF lo advierte. */
  sinCerrar: boolean;
  cliente: Renglon[];
  servicio: Renglon[];
  equipo: Renglon[];
  /** Todo el catálogo, como las casillas del papel; `marcada` dice cuáles se hicieron. */
  actividades: { nombre: string; marcada: boolean }[];
  fallas: { nombre: string; marcada: boolean }[];
  lecturas: { parametro: string; inicial: string; posterior: string }[];
  notas: string | null;
  firmas: {
    titulo: string;
    firmada: boolean;
    nombre: string;
    cargo: string;
    fecha: string;
    /** Cada trazo como "x1,y1 x2,y2 …", listo para dibujarse. */
    trazos: string[];
  }[];
};

const RAYA = "—";
const conUnidad = (valor: string, unidad: string) =>
  valor ? `${valor} ${unidad}` : RAYA;

export function datosOrdenPdf(e: EntradaPdfOrden): DatosPdfOrden {
  const { orden, equipo, captura } = e;
  const esVisita = orden.tipo === "visita";

  const cliente: Renglon[] = esVisita
    ? [
        { etiqueta: "Cliente", valor: orden.cliente ?? RAYA },
        { etiqueta: "Planta", valor: orden.planta ?? RAYA },
        { etiqueta: "Dirección", valor: orden.direccion ?? RAYA },
      ]
    : [{ etiqueta: "Lugar", valor: "Taller de MOT" }];

  const servicio: Renglon[] = [
    { etiqueta: "Folio", valor: orden.folio },
    {
      etiqueta: "Fecha",
      valor: formatDia(orden.fecha_real ?? orden.fecha_programada),
    },
    { etiqueta: "Técnico", valor: orden.tecnico },
  ];
  if (orden.acompanante)
    servicio.push({ etiqueta: "Acompañante", valor: orden.acompanante });
  servicio.push({ etiqueta: "Robox", valor: orden.robox ?? RAYA });

  const datosEquipo: Renglon[] = [
    { etiqueta: "ID de caso", valor: captura.id_caso || RAYA },
    {
      etiqueta: "Equipo",
      valor: equipo
        ? `${equipo.identificador}${equipo.alias ? ` (${equipo.alias})` : ""}`
        : RAYA,
    },
    { etiqueta: "Aplicación", valor: equipo?.aplicacion ?? RAYA },
    { etiqueta: "Aceite", valor: equipo?.aceite ?? RAYA },
    {
      etiqueta: "Reservorio",
      valor: conUnidad(captura.volumen_reservorio_l, "litros"),
    },
    {
      etiqueta: "Temperatura",
      valor: conUnidad(captura.temperatura_aceite_c, "°C"),
    },
  ];

  const firmas = [
    { titulo: "Molecular Oil Technology", firma: captura.firmas.tecnico },
    ...(esVisita
      ? [
          {
            titulo: "Responsable por parte del cliente, quien recibe o acepta",
            firma: captura.firmas.cliente,
          },
        ]
      : []),
  ].map(({ titulo, firma }) => {
    const firmada = estaFirmada(firma);
    return {
      titulo,
      firmada,
      // Sin firma dibujada no se imprime nombre ni fecha: no está firmado.
      nombre: firmada ? firma.nombre : "",
      cargo: firmada ? firma.cargo : "",
      fecha: firmada && firma.fecha ? formatDia(firma.fecha) : "",
      trazos: firma.trazos.map(puntosDeTrazo),
    };
  });

  return {
    folio: orden.folio,
    nombreArchivo: `Orden-${orden.folio.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`,
    tipo: etiqueta(TIPOS_ORDEN, orden.tipo),
    sinCerrar: orden.estado !== "cerrada",
    cliente,
    servicio,
    equipo: datosEquipo,
    actividades: e.actividades.map((a) => {
      const marcada = a.id in captura.actividades;
      const cantidad = captura.actividades[a.id];
      return {
        nombre: marcada && cantidad ? `${a.nombre} (${cantidad})` : a.nombre,
        marcada,
      };
    }),
    fallas: e.fallas.map((f) => ({
      nombre: f.nombre,
      marcada: captura.fallas.includes(f.id),
    })),
    lecturas: CAMPOS_LECTURA.map((c) => ({
      parametro: c.unidad ? `${c.label} (${c.unidad})` : c.label,
      inicial: captura.lecturas.inicial[c.name] || RAYA,
      posterior: captura.lecturas.posterior[c.name] || RAYA,
    })),
    notas: captura.observaciones || null,
    firmas,
  };
}
