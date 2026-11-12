import "server-only";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { EMPRESA } from "@/lib/empresa";
import { LOGO_MOT_PNG } from "./logo-pdf";
import type { DatosPdf } from "./pdf-datos";

// Sin esto, el PDF parte las palabras con guion al final del renglón
// ("QUIN-TOLUBRIC"), y los nombres de productos y lugares deben ir completos.
Font.registerHyphenationCallback((palabra) => [palabra]);

// Colores de marca (los mismos del tema de la app, en hexadecimal para el PDF).
const AZUL = "#2f4a90";
const GRIS = "#5b6472";
const LINEA = "#d9dde5";

const s = StyleSheet.create({
  pagina: {
    paddingTop: 36,
    paddingBottom: 70,
    paddingHorizontal: 44,
    fontSize: 9,
    color: "#1b2233",
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logo: { width: 118, height: 54 },
  empresa: { textAlign: "right" },
  razonSocial: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: AZUL },
  empresaLinea: { fontSize: 8.5, color: GRIS, marginTop: 1.5 },
  franja: { height: 2, backgroundColor: AZUL, marginTop: 10, marginBottom: 12 },
  titulo: { fontSize: 14, fontFamily: "Helvetica-Bold", color: AZUL },
  borrador: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#b45309",
    marginTop: 2,
  },
  bloques: { flexDirection: "row", gap: 20, marginTop: 10, marginBottom: 14 },
  bloqueCliente: { flex: 1.25 },
  bloqueDatos: { flex: 1 },
  renglon: { flexDirection: "row", marginBottom: 3 },
  etiqueta: { width: 62, color: GRIS },
  etiquetaAncha: { width: 98, color: GRIS },
  valor: { flex: 1 },
  valorFuerte: { flex: 1, fontFamily: "Helvetica-Bold" },
  filaEncabezado: {
    flexDirection: "row",
    backgroundColor: AZUL,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINEA,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  cDescripcion: { flex: 1, paddingRight: 8 },
  cParte: { width: 88, paddingRight: 6 },
  cCantidad: { width: 66 },
  cPrecio: { width: 80, textAlign: "right" },
  cSubtotal: { width: 88, textAlign: "right" },
  secundario: { fontSize: 8, color: GRIS, marginTop: 2 },
  totales: { marginTop: 8, alignSelf: "flex-end", width: 270 },
  filaTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  total: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  seccion: { marginTop: 16 },
  tituloSeccion: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 4,
  },
  nota: { flexDirection: "row", marginBottom: 2.5 },
  notaNumero: { width: 16 },
  notaTexto: { flex: 1, lineHeight: 1.35 },
  pie: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    fontSize: 7,
    color: GRIS,
    borderTopWidth: 0.5,
    borderTopColor: LINEA,
    paddingTop: 5,
  },
  pieFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  leyenda: { fontFamily: "Helvetica-Bold", color: AZUL },
});

/** Cotización para el cliente, con la estructura de la cotización tipo de MOT. */
function CotizacionPdf({ d }: { d: DatosPdf }) {
  return (
    <Document
      title={`Cotización ${d.folio}`}
      author={EMPRESA.razonSocial}
      language="es-MX"
    >
      <Page size="LETTER" style={s.pagina}>
        <View style={s.encabezado}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- es una imagen de PDF, no de HTML */}
          <Image src={LOGO_MOT_PNG} style={s.logo} />
          <View style={s.empresa}>
            <Text style={s.razonSocial}>{EMPRESA.razonSocial}</Text>
            <Text style={s.empresaLinea}>{EMPRESA.rfc}</Text>
            {EMPRESA.domicilio.map((linea) => (
              <Text key={linea} style={s.empresaLinea}>
                {linea}
              </Text>
            ))}
          </View>
        </View>
        <View style={s.franja} />

        <Text style={s.titulo}>Cotización</Text>
        {d.esBorrador ? (
          <Text style={s.borrador}>BORRADOR · no enviar al cliente</Text>
        ) : null}

        <View style={s.bloques}>
          <View style={s.bloqueCliente}>
            {d.cliente.map((r, i) => (
              <View key={r.etiqueta} style={s.renglon}>
                <Text style={s.etiqueta}>{r.etiqueta}:</Text>
                <Text style={i === 0 ? s.valorFuerte : s.valor}>{r.valor}</Text>
              </View>
            ))}
          </View>
          <View style={s.bloqueDatos}>
            {d.encabezado.map((r, i) => (
              <View key={r.etiqueta} style={s.renglon}>
                <Text style={s.etiquetaAncha}>{r.etiqueta}:</Text>
                <Text style={i === 0 ? s.valorFuerte : s.valor}>{r.valor}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.filaEncabezado} fixed>
          <Text style={s.cDescripcion}>Descripción</Text>
          <Text style={s.cParte}>No. parte cliente</Text>
          <Text style={s.cCantidad}>Unidades</Text>
          <Text style={s.cPrecio}>Precio unitario</Text>
          <Text style={s.cSubtotal}>Subtotal</Text>
        </View>
        {d.partidas.map((p, i) => (
          <View key={i} style={s.fila} wrap={false}>
            <View style={s.cDescripcion}>
              <Text>{p.descripcion}</Text>
              {p.detalle ? <Text style={s.secundario}>{p.detalle}</Text> : null}
            </View>
            <Text style={s.cParte}>{p.numeroParte}</Text>
            <Text style={s.cCantidad}>{p.cantidad}</Text>
            <Text style={s.cPrecio}>{p.precioUnitario}</Text>
            <Text style={s.cSubtotal}>{p.subtotal}</Text>
          </View>
        ))}

        <View style={s.totales} wrap={false}>
          {d.totales.map((t) => (
            <View key={t.etiqueta} style={s.filaTotal}>
              <Text style={s.total}>{t.etiqueta}</Text>
              <Text style={s.total}>{t.valor}</Text>
            </View>
          ))}
          {d.datosAdicionales.map((x) => (
            <View key={x.etiqueta} style={s.filaTotal}>
              <Text>{x.etiqueta}</Text>
              <Text>{x.valor}</Text>
            </View>
          ))}
        </View>

        <View style={s.seccion}>
          <Text style={s.tituloSeccion}>Notas</Text>
          {d.notas.map((nota, i) => (
            <View key={i} style={s.nota} wrap={false}>
              <Text style={s.notaNumero}>{i + 1}.-</Text>
              <Text style={s.notaTexto}>{nota}</Text>
            </View>
          ))}
        </View>

        <View style={s.pie} fixed>
          <View style={s.pieFila}>
            <Text style={s.leyenda}>{EMPRESA.leyendaPie}</Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `Página ${pageNumber} de ${totalPages}`
              }
            />
          </View>
          <Text>{EMPRESA.domicilioPie}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function generarPdfCotizacion(datos: DatosPdf): Promise<Buffer> {
  return renderToBuffer(<CotizacionPdf d={datos} />);
}
