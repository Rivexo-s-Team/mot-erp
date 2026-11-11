import { MONEDAS } from "@/lib/clientes/campos";
import type { Campo, Opcion, Validador } from "@/lib/forms/campos";

/** Cotizaciones de partidas libres (DISENO §4.2 y decisión D10). */

export const UNIDADES: Opcion[] = [
  { value: "litro", label: "Litro" },
  { value: "mes", label: "Mes" },
  { value: "evento", label: "Evento" },
  { value: "servicio", label: "Servicio" },
];

export const ESTADOS: Opcion[] = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviada" },
];

export const FUENTES: Opcion[] = [
  { value: "comprobante_cliente", label: "Comprobante del cliente" },
  { value: "internet", label: "Búsqueda en internet" },
];

export const etiqueta = (opciones: Opcion[], valor: string | null) =>
  opciones.find((o) => o.value === valor)?.label ?? valor ?? "—";

export const CAMPOS_COTIZACION: Campo[] = [
  {
    name: "moneda",
    label: "Moneda",
    tipo: "opciones",
    opciones: MONEDAS,
    valorInicial: "USD",
  },
  {
    name: "tipo_cambio",
    label: "Tipo de cambio (pesos por dólar)",
    tipo: "numero",
    opcional: true,
    ayuda:
      "Solo si la cotización es en pesos. Sirve para comparar contra el precio mínimo por litro.",
  },
  { name: "vigencia", label: "Vigente hasta", tipo: "fecha", opcional: true },
  {
    name: "valor_total_contrato",
    label: "Valor total del contrato",
    tipo: "numero",
    opcional: true,
    ayuda:
      "Si es una renta: lo que vale todo el contrato, en la moneda de la cotización.",
  },
  {
    name: "litros_estimados",
    label: "Litros estimados a vender",
    tipo: "numero",
    opcional: true,
    ayuda: "Si se cotiza por litro.",
  },
  {
    name: "condiciones",
    label: "Condiciones comerciales",
    tipo: "textoLargo",
    opcional: true,
    ayuda:
      "Lo que verá el cliente: forma de pago, anticipo, plazo, qué incluye.",
  },
  {
    name: "notas",
    label: "Notas internas",
    tipo: "textoLargo",
    opcional: true,
  },
];

export const validarCotizacion: Validador = (v) =>
  v.moneda !== "USD" && String(v.tipo_cambio ?? "").trim() === ""
    ? {
        campo: "tipo_cambio",
        mensaje: "Escribe el tipo de cambio para cotizar en pesos.",
      }
    : null;

/** Campos del cotizador por litro; solo aplican a partidas por litro. */
export const CAMPOS_REFERENCIA = [
  "precio_referencia",
  "fuente_tipo",
  "fuente_url",
  "fecha_referencia",
] as const;

export function camposPartida(equipos: Opcion[]): Campo[] {
  return [
    {
      name: "concepto",
      label: "Concepto",
      tipo: "texto",
      ayuda:
        "Lo que se cobra. Ejemplos: Limpieza de aceite por litro, Renta mensual de Robox.",
    },
    {
      name: "equipo_cliente_id",
      label: "Equipo del cliente",
      tipo: "referencia",
      opcional: true,
      opciones: equipos,
    },
    {
      name: "unidad",
      label: "Unidad",
      tipo: "opciones",
      opciones: UNIDADES,
      valorInicial: "litro",
    },
    {
      name: "cantidad",
      label: "Cantidad",
      tipo: "numero",
      ayuda: "Litros, meses, eventos o servicios, según la unidad.",
    },
    {
      name: "recurrente",
      label: "Partida recurrente (se cobra cada periodo)",
      tipo: "casilla",
    },
    {
      name: "precio_referencia",
      label: "Precio del aceite nuevo por litro",
      tipo: "numero",
      opcional: true,
      ayuda:
        "Opcional. Con este dato el cotizador sugiere el precio por litro.",
    },
    {
      name: "fuente_tipo",
      label: "De dónde salió ese precio",
      tipo: "opciones",
      opcional: true,
      opciones: FUENTES,
    },
    {
      name: "fuente_url",
      label: "Enlace de la fuente",
      tipo: "texto",
      opcional: true,
      max: 500,
    },
    {
      name: "fecha_referencia",
      label: "Fecha del precio de referencia",
      tipo: "fecha",
      opcional: true,
    },
    {
      name: "precio_unitario",
      label: "Precio unitario",
      tipo: "numero",
      opcional: true,
      ayuda: "Lo que se le cobra al cliente por unidad.",
    },
    {
      name: "orden",
      label: "Orden en la cotización",
      tipo: "entero",
      ayuda: "Los números menores aparecen primero.",
    },
  ];
}

export const validarPartida: Validador = (v) => {
  const precio = String(v.precio_unitario ?? "").trim();
  const referencia = String(v.precio_referencia ?? "").trim();
  if (precio === "" && (v.unidad !== "litro" || referencia === "")) {
    return {
      campo: "precio_unitario",
      mensaje:
        v.unidad === "litro"
          ? "Escribe el precio, o el precio del aceite nuevo para usar el sugerido."
          : "Escribe el precio unitario.",
    };
  }
  if (referencia !== "" && v.unidad !== "litro") {
    return {
      campo: "precio_referencia",
      mensaje: "El precio del aceite nuevo solo aplica a partidas por litro.",
    };
  }
  if (referencia !== "" && String(v.fuente_tipo ?? "") === "") {
    return {
      campo: "fuente_tipo",
      mensaje: "Indica de dónde salió el precio del aceite nuevo.",
    };
  }
  return null;
};

/** "280 litros", "1 mes", "36 meses", "2 servicios". */
export function describirCantidad(cantidad: number, unidad: string): string {
  const nombre = etiqueta(UNIDADES, unidad).toLowerCase();
  const plural =
    cantidad === 1 ? nombre : unidad === "mes" ? "meses" : `${nombre}s`;
  return `${cantidad} ${plural}`;
}
