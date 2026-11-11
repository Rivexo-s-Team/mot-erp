import "server-only";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { LOGO_MOT_PNG } from "./logo-pdf";
import type { DatosPdf } from "./pdf-datos";

// Colores de marca (los mismos del tema de la app, en hexadecimal para el PDF).
const AZUL = "#2f4a90";
const GRIS = "#5b6472";
const LINEA = "#d9dde5";

const s = StyleSheet.create({
  pagina: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 9.5,
    color: "#1b2233",
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logo: { width: 120, height: 55 },
  titulo: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    textAlign: "right",
  },
  subtitulo: { fontSize: 9, color: GRIS, textAlign: "right", marginTop: 3 },
  borrador: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#b45309",
    textAlign: "right",
    marginTop: 3,
  },
  franja: { height: 2, backgroundColor: AZUL, marginTop: 12, marginBottom: 14 },
  bloque: { flexDirection: "row", gap: 24, marginBottom: 16 },
  columna: { flex: 1 },
  etiqueta: { fontSize: 8, color: GRIS, marginBottom: 2 },
  valor: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  valorNormal: { fontSize: 10 },
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
  cConcepto: { flex: 1, paddingRight: 8 },
  cCantidad: { width: 78 },
  cPrecio: { width: 88, textAlign: "right" },
  cImporte: { width: 92, textAlign: "right" },
  secundario: { fontSize: 8, color: GRIS, marginTop: 2 },
  totales: { marginTop: 10, alignSelf: "flex-end", width: 270 },
  filaTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  total: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  seccion: { marginTop: 18 },
  tituloSeccion: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 4,
  },
  parrafo: { lineHeight: 1.4 },
  pie: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: GRIS,
    borderTopWidth: 0.5,
    borderTopColor: LINEA,
    paddingTop: 6,
  },
});

/**
 * Formato provisional de la cotización para el cliente.
 * PENDIENTE: ajustar al formato real de MOT cuando el director comercial comparta un ejemplo.
 */
function CotizacionPdf({ d }: { d: DatosPdf }) {
  return (
    <Document
      title={d.titulo}
      author="Molecular Oil Technology"
      language="es-MX"
    >
      <Page size="LETTER" style={s.pagina}>
        <View style={s.encabezado}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- es una imagen de PDF, no de HTML */}
          <Image src={LOGO_MOT_PNG} style={s.logo} />
          <View>
            <Text style={s.titulo}>{d.titulo}</Text>
            <Text style={s.subtitulo}>Fecha: {d.fecha}</Text>
            {d.vigencia ? (
              <Text style={s.subtitulo}>Vigente hasta: {d.vigencia}</Text>
            ) : null}
            {d.esBorrador ? (
              <Text style={s.borrador}>BORRADOR · no enviar al cliente</Text>
            ) : null}
          </View>
        </View>
        <View style={s.franja} />

        <View style={s.bloque}>
          <View style={s.columna}>
            <Text style={s.etiqueta}>Cliente</Text>
            <Text style={s.valor}>{d.cliente}</Text>
            {d.planta ? (
              <Text style={s.valorNormal}>Planta {d.planta}</Text>
            ) : null}
          </View>
          <View style={s.columna}>
            <Text style={s.etiqueta}>Referencia</Text>
            <Text style={s.valorNormal}>{d.referencia}</Text>
          </View>
        </View>

        <View style={s.filaEncabezado} fixed>
          <Text style={s.cConcepto}>Concepto</Text>
          <Text style={s.cCantidad}>Cantidad</Text>
          <Text style={s.cPrecio}>Precio unitario</Text>
          <Text style={s.cImporte}>Importe</Text>
        </View>
        {d.partidas.map((p, i) => (
          <View key={i} style={s.fila} wrap={false}>
            <View style={s.cConcepto}>
              <Text>{p.concepto}</Text>
              <Text style={s.secundario}>
                {[p.equipo ? `Equipo ${p.equipo}` : null, p.tipo]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <Text style={s.cCantidad}>{p.cantidad}</Text>
            <Text style={s.cPrecio}>{p.precioUnitario}</Text>
            <Text style={s.cImporte}>{p.importe}</Text>
          </View>
        ))}

        <View style={s.totales} wrap={false}>
          {d.totales.map((t) => (
            <View key={t.etiqueta} style={s.filaTotal}>
              <Text>{t.etiqueta}</Text>
              <Text style={s.total}>{t.valor}</Text>
            </View>
          ))}
          <Text style={s.secundario}>{d.notaImportes}</Text>
        </View>

        {d.datosAdicionales.length > 0 ? (
          <View style={s.totales} wrap={false}>
            {d.datosAdicionales.map((x) => (
              <View key={x.etiqueta} style={s.filaTotal}>
                <Text>{x.etiqueta}</Text>
                <Text style={s.total}>{x.valor}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {d.condiciones ? (
          <View style={s.seccion}>
            <Text style={s.tituloSeccion}>Condiciones comerciales</Text>
            <Text style={s.parrafo}>{d.condiciones}</Text>
          </View>
        ) : null}

        <View style={s.pie} fixed>
          <Text>Molecular Oil Technology, S.A.P.I. de C.V.</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export function generarPdfCotizacion(datos: DatosPdf): Promise<Buffer> {
  return renderToBuffer(<CotizacionPdf d={datos} />);
}
