import "server-only";
import {
  Document,
  Font,
  Image,
  Page,
  Polyline,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { LOGO_MOT_PNG } from "@/lib/cotizaciones/logo-pdf";
import { EMPRESA } from "@/lib/empresa";
import { LIENZO_FIRMA } from "./captura";
import type { DatosPdfOrden } from "./pdf-datos";

// Sin esto, el PDF parte las palabras con guion al final del renglón.
Font.registerHyphenationCallback((palabra) => [palabra]);

// Colores de marca (los mismos del tema de la app, en hexadecimal para el PDF).
const AZUL = "#2f4a90";
const GRIS = "#5b6472";
const LINEA = "#d9dde5";

const s = StyleSheet.create({
  pagina: {
    paddingTop: 28,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 8.5,
    color: "#1b2233",
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logo: { width: 92, height: 42 },
  empresa: { textAlign: "right" },
  razonSocial: { fontSize: 10, fontFamily: "Helvetica-Bold", color: AZUL },
  empresaLinea: { fontSize: 8, color: GRIS, marginTop: 1.5 },
  franja: { height: 2, backgroundColor: AZUL, marginTop: 6, marginBottom: 8 },
  filaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  titulo: { fontSize: 14, fontFamily: "Helvetica-Bold", color: AZUL },
  folio: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  tipo: { fontSize: 8.5, color: GRIS, marginTop: 2 },
  aviso: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#b45309",
    marginTop: 3,
  },
  bloques: { flexDirection: "row", gap: 18, marginTop: 8 },
  bloque: { flex: 1 },
  renglon: { flexDirection: "row", marginBottom: 2.5 },
  etiqueta: { width: 62, color: GRIS },
  valor: { flex: 1 },
  seccion: { marginTop: 9 },
  tituloSeccion: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: LINEA,
  },
  rejilla: { flexDirection: "row", flexWrap: "wrap" },
  celdaEquipo: { width: "33.33%", flexDirection: "row", marginBottom: 2.5 },
  casillas: { flexDirection: "row", flexWrap: "wrap" },
  casilla: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2.5,
  },
  cuadro: {
    width: 7,
    height: 7,
    borderWidth: 0.7,
    borderColor: "#1b2233",
    marginRight: 4,
  },
  cuadroMarcado: { backgroundColor: AZUL, borderColor: AZUL },
  marcada: { fontFamily: "Helvetica-Bold" },
  filaEncabezado: {
    flexDirection: "row",
    backgroundColor: AZUL,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
  },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINEA,
    paddingVertical: 2.1,
    paddingHorizontal: 6,
  },
  cParametro: { flex: 1.4 },
  cLectura: { flex: 1 },
  notas: { lineHeight: 1.35 },
  firmas: { flexDirection: "row", gap: 18, marginTop: 10 },
  firma: { flex: 1 },
  tituloFirma: { fontSize: 8, color: GRIS, marginBottom: 3 },
  cajaFirma: {
    height: 52,
    borderWidth: 0.5,
    borderColor: LINEA,
    marginBottom: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  sinFirma: { color: GRIS, fontSize: 8 },
  nombreFirma: { fontFamily: "Helvetica-Bold" },
  pie: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
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

function Renglones({
  renglones,
}: {
  renglones: { etiqueta: string; valor: string }[];
}) {
  return (
    <>
      {renglones.map((r) => (
        <View key={r.etiqueta} style={s.renglon}>
          <Text style={s.etiqueta}>{r.etiqueta}:</Text>
          <Text style={s.valor}>{r.valor}</Text>
        </View>
      ))}
    </>
  );
}

function Casillas({
  titulo,
  opciones,
}: {
  titulo: string;
  opciones: { nombre: string; marcada: boolean }[];
}) {
  return (
    <View style={s.bloque}>
      <Text style={s.tituloSeccion}>{titulo}</Text>
      <View style={s.casillas}>
        {opciones.map((o) => (
          <View key={o.nombre} style={s.casilla}>
            <View style={o.marcada ? [s.cuadro, s.cuadroMarcado] : s.cuadro} />
            <Text style={o.marcada ? [s.valor, s.marcada] : s.valor}>
              {o.nombre}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Orden de servicio, con la estructura del formato "Servicio RecondOil Box". */
function OrdenPdf({ d }: { d: DatosPdfOrden }) {
  return (
    <Document
      title={`Orden de servicio ${d.folio}`}
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

        <View style={s.filaTitulo}>
          <View>
            <Text style={s.titulo}>Servicio RecondOil Box</Text>
            <Text style={s.tipo}>{d.tipo}</Text>
          </View>
          <Text style={s.folio}>{d.folio}</Text>
        </View>
        {d.sinCerrar ? (
          <Text style={s.aviso}>
            ORDEN SIN CERRAR · no es el documento final
          </Text>
        ) : null}

        <View style={s.bloques}>
          <View style={s.bloque}>
            <Renglones renglones={d.cliente} />
          </View>
          <View style={s.bloque}>
            <Renglones renglones={d.servicio} />
          </View>
        </View>

        <View style={s.seccion}>
          <Text style={s.tituloSeccion}>Equipo</Text>
          <View style={s.rejilla}>
            {d.equipo.map((r) => (
              <View key={r.etiqueta} style={s.celdaEquipo}>
                <Text style={s.etiqueta}>{r.etiqueta}:</Text>
                <Text style={s.valor}>{r.valor}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.bloques, { marginTop: 9 }]} wrap={false}>
          <Casillas titulo="Servicio / Revisión" opciones={d.actividades} />
          <Casillas titulo="Falla / Problema" opciones={d.fallas} />
        </View>

        <View style={s.seccion} wrap={false}>
          <Text style={s.tituloSeccion}>Parámetros ROBX</Text>
          <View style={s.filaEncabezado}>
            <Text style={s.cParametro}>Parámetro</Text>
            <Text style={s.cLectura}>Inicial</Text>
            <Text style={s.cLectura}>Posterior</Text>
          </View>
          {d.lecturas.map((l) => (
            <View key={l.parametro} style={s.fila}>
              <Text style={s.cParametro}>{l.parametro}</Text>
              <Text style={s.cLectura}>{l.inicial}</Text>
              <Text style={s.cLectura}>{l.posterior}</Text>
            </View>
          ))}
        </View>

        {d.partes.length > 0 ? (
          <View style={s.seccion} wrap={false}>
            <Text style={s.tituloSeccion}>Partes y accesorios</Text>
            <Text style={s.notas}>{d.partes.join("  ·  ")}</Text>
          </View>
        ) : null}

        {d.notas ? (
          <View style={s.seccion} wrap={false}>
            <Text style={s.tituloSeccion}>Otros / Notas</Text>
            <Text style={s.notas}>{d.notas}</Text>
          </View>
        ) : null}

        <View style={s.firmas} wrap={false}>
          {d.firmas.map((f) => (
            <View key={f.titulo} style={s.firma}>
              <Text style={s.tituloFirma}>{f.titulo}</Text>
              <View style={s.cajaFirma}>
                {f.firmada ? (
                  <Svg
                    viewBox={`0 0 ${LIENZO_FIRMA.ancho} ${LIENZO_FIRMA.alto}`}
                    style={{ width: 125, height: 50 }}
                  >
                    {f.trazos.map((puntos, i) => (
                      <Polyline
                        key={i}
                        points={puntos}
                        fill="none"
                        stroke="#1b2233"
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </Svg>
                ) : (
                  <Text style={s.sinFirma}>Sin firmar</Text>
                )}
              </View>
              <View style={s.renglon}>
                <Text style={s.etiqueta}>Nombre:</Text>
                <Text style={[s.valor, s.nombreFirma]}>{f.nombre}</Text>
              </View>
              <View style={s.renglon}>
                <Text style={s.etiqueta}>Cargo:</Text>
                <Text style={s.valor}>{f.cargo}</Text>
              </View>
              <View style={s.renglon}>
                <Text style={s.etiqueta}>Fecha:</Text>
                <Text style={s.valor}>{f.fecha}</Text>
              </View>
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

export function generarPdfOrden(datos: DatosPdfOrden): Promise<Buffer> {
  return renderToBuffer(<OrdenPdf d={datos} />);
}
