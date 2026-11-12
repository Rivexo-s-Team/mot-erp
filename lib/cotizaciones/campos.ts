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
  { value: "aceptada", label: "Aceptada" },
  { value: "rechazada", label: "Rechazada" },
];

export const FUENTES: Opcion[] = [
  { value: "comprobante_cliente", label: "Comprobante del cliente" },
  { value: "internet", label: "Búsqueda en internet" },
];

export const etiqueta = (opciones: Opcion[], valor: string | null) =>
  opciones.find((o) => o.value === valor)?.label ?? valor ?? "—";

/** Datos generales de la cotización. `contactos` son las personas del cliente. */
export function camposCotizacion(contactos: Opcion[]): Campo[] {
  return [
    {
      name: "contacto_id",
      label: "Atención (a quién va dirigida)",
      tipo: "referencia",
      opcional: true,
      opciones: contactos,
      ayuda:
        contactos.length === 0
          ? "Este cliente aún no tiene contactos. Agrégalos en su ficha para elegir uno."
          : "En el PDF salen su nombre, teléfono y correo.",
    },
    {
      name: "numero_requisicion",
      label: "No. de requisición del cliente",
      tipo: "texto",
      opcional: true,
      max: 60,
    },
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
    { name: "vigencia", label: "Válida hasta", tipo: "fecha", opcional: true },
    {
      name: "condiciones_pago",
      label: "Condiciones de pago",
      tipo: "texto",
      opcional: true,
      max: 120,
      ayuda: "Ejemplos: Contado, 30 días.",
    },
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
      label: "Notas para el cliente",
      tipo: "textoLargo",
      opcional: true,
      ayuda:
        'Una nota por renglón; en el PDF salen numeradas después de "Precios más IVA" y la moneda.',
    },
    {
      name: "notas",
      label: "Notas internas (no salen en el PDF)",
      tipo: "textoLargo",
      opcional: true,
    },
  ];
}

export const validarCotizacion: Validador = (v) =>
  v.moneda !== "USD" && String(v.tipo_cambio ?? "").trim() === ""
    ? {
        campo: "tipo_cambio",
        mensaje: "Escribe el tipo de cambio para cotizar en pesos.",
      }
    : null;

/** Campos del cotizador por litro; solo aplican a partidas por litro. */
export const CAMPOS_REFERENCIA = [
  "referencia_costo_contenedor",
  "referencia_litros_contenedor",
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
      name: "numero_parte_cliente",
      label: "No. de parte del cliente",
      tipo: "texto",
      opcional: true,
      max: 80,
    },
    {
      name: "referencia_costo_contenedor",
      label: "Costo de un contenedor de aceite nuevo",
      tipo: "numero",
      opcional: true,
      ayuda:
        "Opcional. Con el costo y los litros del contenedor se calcula el precio por litro.",
    },
    {
      name: "referencia_litros_contenedor",
      label: "Litros del contenedor",
      tipo: "numero",
      opcional: true,
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
  const t = (campo: string) => String(v[campo] ?? "").trim();
  const precio = t("precio_unitario");
  const costo = t("referencia_costo_contenedor");
  const litros = t("referencia_litros_contenedor");
  const hayContenedor = costo !== "" && litros !== "";
  const hayReferencia = t("precio_referencia") !== "" || hayContenedor;

  if ((costo === "") !== (litros === "")) {
    return {
      campo:
        costo === ""
          ? "referencia_costo_contenedor"
          : "referencia_litros_contenedor",
      mensaje: "Captura el costo del contenedor y también sus litros.",
    };
  }
  if (litros !== "" && Number(litros) === 0) {
    return {
      campo: "referencia_litros_contenedor",
      mensaje: "Los litros deben ser mayores que cero.",
    };
  }
  if (precio === "" && (v.unidad !== "litro" || !hayReferencia)) {
    return {
      campo: "precio_unitario",
      mensaje:
        v.unidad === "litro"
          ? "Escribe el precio, o el costo del aceite nuevo para usar el sugerido."
          : "Escribe el precio unitario.",
    };
  }
  if (hayReferencia && v.unidad !== "litro") {
    return {
      campo: hayContenedor
        ? "referencia_costo_contenedor"
        : "precio_referencia",
      mensaje: "El costo del aceite nuevo solo aplica a partidas por litro.",
    };
  }
  if (hayReferencia && t("fuente_tipo") === "") {
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
