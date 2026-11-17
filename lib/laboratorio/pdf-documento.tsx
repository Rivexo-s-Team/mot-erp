import "server-only";
import {
  Circle,
  Document,
  Font,
  Image,
  Line,
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
import { CAJA_PDF, NOTAS_INFORME, type DatosPdfInforme } from "./pdf-datos";

// Sin esto, el PDF parte las palabras con guion al final del renglón.
Font.registerHyphenationCallback((palabra) => [palabra]);

// Colores de marca (los mismos del tema de la app, en hexadecimal para el PDF).
const AZUL = "#2f4a90";
const GRIS = "#5b6472";
const LINEA = "#d9dde5";
const ROJO = "#c81e1e";
const TINTA = "#1b2233";

const s = StyleSheet.create({
  pagina: {
    paddingTop: 26,
    paddingBottom: 50,
    paddingHorizontal: 34,
    fontSize: 7.5,
    color: TINTA,
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logo: { width: 84, height: 38 },
  centro: { flex: 1, paddingHorizontal: 14 },
  titulo: { fontSize: 13, fontFamily: "Helvetica-Bold", color: AZUL },
  subtitulo: { fontSize: 8.5, color: GRIS, marginTop: 2 },
  derecha: { alignItems: "flex-end" },
  folio: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  dato: { fontSize: 8, color: GRIS, marginTop: 2 },
  condicion: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 3 },
  aviso: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#b45309",
    marginTop: 3,
  },
  franja: { height: 2, backgroundColor: AZUL, marginTop: 6, marginBottom: 7 },
  bloques: { flexDirection: "row", gap: 16 },
  bloque: { flex: 1 },
  tituloBloque: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 3,
  },
  renglon: { flexDirection: "row", marginBottom: 2 },
  etiqueta: { width: 74, color: GRIS },
  valor: { flex: 1 },
  seccion: { marginTop: 9 },
  tituloSeccion: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 4,
  },
  filaEncabezado: {
    flexDirection: "row",
    backgroundColor: AZUL,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINEA,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  filaGrupo: {
    flexDirection: "row",
    backgroundColor: "#eef1f6",
    paddingVertical: 2.5,
    paddingHorizontal: 5,
  },
  grupo: { fontFamily: "Helvetica-Bold", color: AZUL },
  cNombre: { width: 128 },
  cUnidad: { width: 46, color: GRIS },
  cMuestra: { flex: 1, textAlign: "right" },
  cLimite: { width: 62, textAlign: "right", color: GRIS },
  cDesviacion: { width: 46, textAlign: "right", color: GRIS },
  fuerte: { fontFamily: "Helvetica-Bold" },
  noPasa: { fontFamily: "Helvetica-Bold", color: ROJO },
  nota: { fontSize: 6.5, color: GRIS, lineHeight: 1.35, marginTop: 5 },
  leyenda: { fontSize: 7, color: GRIS, marginBottom: 5 },
  graficas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grafica: {
    width: CAJA_PDF.ancho + 10,
    borderWidth: 0.5,
    borderColor: LINEA,
    borderRadius: 3,
    padding: 5,
  },
  graficaTitulo: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  graficaDato: { fontSize: 6.5, color: GRIS, marginTop: 1, marginBottom: 2 },
  eje: { fontSize: 5.5, color: GRIS },
  observaciones: { lineHeight: 1.4, fontSize: 8.5 },
  firmas: { flexDirection: "row", gap: 16, marginTop: 12 },
  firma: {
    flex: 1,
    borderTopWidth: 0.5,
    borderTopColor: TINTA,
    paddingTop: 3,
  },
  firmaTitulo: { fontSize: 7.5, color: GRIS },
  firmaNombre: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 1 },
  pie: {
    position: "absolute",
    bottom: 16,
    left: 34,
    right: 34,
    fontSize: 6.5,
    color: GRIS,
    borderTopWidth: 0.5,
    borderTopColor: LINEA,
    paddingTop: 4,
  },
  pieFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  pieLeyenda: { fontFamily: "Helvetica-Bold", color: AZUL },
});

function Renglones({
  titulo,
  renglones,
}: {
  titulo: string;
  renglones: { etiqueta: string; valor: string }[];
}) {
  return (
    <View style={s.bloque}>
      <Text style={s.tituloBloque}>{titulo}</Text>
      {renglones.map((r) => (
        <View key={r.etiqueta} style={s.renglon}>
          <Text style={s.etiqueta}>{r.etiqueta}:</Text>
          <Text style={s.valor}>{r.valor}</Text>
        </View>
      ))}
    </View>
  );
}

function Encabezado({ d }: { d: DatosPdfInforme }) {
  return (
    <View fixed>
      <View style={s.encabezado}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- es una imagen de PDF, no de HTML */}
        <Image src={LOGO_MOT_PNG} style={s.logo} />
        <View style={s.centro}>
          <Text style={s.titulo}>Análisis de tendencias en aceites</Text>
          <Text style={s.subtitulo}>
            Informe de laboratorio · {EMPRESA.razonSocial}
          </Text>
          {d.sinValidar ? (
            <Text style={s.aviso}>
              BORRADOR SIN VALIDAR · no es el informe final
            </Text>
          ) : null}
        </View>
        <View style={s.derecha}>
          <Text style={s.folio}>{d.folio}</Text>
          <Text style={s.dato}>Fecha de emisión: {d.fechaEmision}</Text>
          {d.condicionGeneral ? (
            <Text style={s.condicion}>
              Condición general: {d.condicionGeneral}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={s.franja} />
    </View>
  );
}

/** Tabla de tendencias de uno o varios grupos de parámetros. */
function Tabla({ d, grupos }: { d: DatosPdfInforme; grupos: string[] }) {
  const visibles = d.grupos.filter((g) => grupos.includes(g.grupo));
  if (visibles.length === 0) return null;
  return (
    <View>
      <View style={s.filaEncabezado} fixed>
        <Text style={s.cNombre}>ID de muestra</Text>
        <Text style={[s.cUnidad, { color: "#ffffff" }]}>Unidad</Text>
        {d.columnas.map((c) => (
          <Text key={c} style={s.cMuestra}>
            {c}
          </Text>
        ))}
        <Text style={[s.cLimite, { color: "#ffffff" }]}>Límite</Text>
        <Text style={[s.cDesviacion, { color: "#ffffff" }]}>Desv.</Text>
      </View>
      {grupos.includes("fisicoquimico")
        ? d.encabezado.map((f) => (
            <View key={f.titulo} style={s.fila} wrap={false}>
              <Text style={f.fuerte ? [s.cNombre, s.fuerte] : s.cNombre}>
                {f.titulo}
              </Text>
              <Text style={s.cUnidad} />
              {f.celdas.map((c, i) => (
                <Text
                  key={i}
                  style={[
                    s.cMuestra,
                    c.noPasa ? s.noPasa : f.fuerte ? s.fuerte : {},
                  ]}
                >
                  {c.texto}
                </Text>
              ))}
              <Text style={s.cLimite} />
              <Text style={s.cDesviacion} />
            </View>
          ))
        : null}
      {visibles.map((g) => (
        <View key={g.grupo}>
          <View style={s.filaGrupo} wrap={false}>
            <Text style={s.grupo}>{g.titulo}</Text>
          </View>
          {g.filas.map((f) => (
            <View key={f.nombre} style={s.fila} wrap={false}>
              <Text style={s.cNombre}>{f.nombre}</Text>
              <Text style={s.cUnidad}>{f.unidad}</Text>
              {f.celdas.map((c, i) => (
                <Text key={i} style={[s.cMuestra, c.noPasa ? s.noPasa : {}]}>
                  {c.texto}
                </Text>
              ))}
              <Text style={s.cLimite}>{f.limite}</Text>
              <Text style={s.cDesviacion}>{f.desviacion}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

type SeriePdf = DatosPdfInforme["graficas"][number]["series"][number];

function Grafica({
  serie,
  fechas,
}: {
  serie: SeriePdf;
  fechas: [string, string] | null;
}) {
  const { margen, ancho, alto } = CAJA_PDF;
  const derecha = ancho - margen.derecha;
  const abajo = alto - margen.abajo;
  const { trazo } = serie;
  return (
    <View style={s.grafica} wrap={false}>
      <Text style={s.graficaTitulo}>
        {serie.nombre}
        {serie.unidad ? ` (${serie.unidad})` : ""}
      </Text>
      <Text style={s.graficaDato}>
        Última: {serie.ultimo}
        {serie.limite ? ` · Límite ${serie.limite}` : ""}
      </Text>
      <Svg
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ width: ancho, height: alto }}
      >
        {[margen.arriba, abajo].map((y) => (
          <Line
            key={y}
            x1={margen.izquierda}
            x2={derecha}
            y1={y}
            y2={y}
            stroke={LINEA}
            strokeWidth={0.5}
          />
        ))}
        {trazo.limites.map((l) => (
          <Line
            key={l.valor}
            x1={margen.izquierda}
            x2={derecha}
            y1={l.y}
            y2={l.y}
            stroke={GRIS}
            strokeWidth={0.5}
          />
        ))}
        {trazo.tramos.map((t, i) => (
          <Polyline
            key={i}
            points={t.map((q) => `${q.x},${q.y}`).join(" ")}
            fill="none"
            stroke={AZUL}
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {trazo.puntos.map((p) =>
          // Lo que no pasa va hueco y en rojo: se distingue también en blanco y negro.
          p.veredicto === "no_pasa" ? (
            <Circle
              key={p.indice}
              cx={p.x}
              cy={p.y}
              r={2.2}
              fill="#ffffff"
              stroke={ROJO}
              strokeWidth={1}
            />
          ) : (
            <Circle key={p.indice} cx={p.x} cy={p.y} r={2} fill={AZUL} />
          ),
        )}
      </Svg>
      {/* Las etiquetas van encima del dibujo: el texto dentro del SVG no usa la fuente del documento. */}
      <Text
        style={[
          s.eje,
          {
            position: "absolute",
            left: 5,
            top: 26 + margen.arriba - 3,
            width: margen.izquierda - 3,
            textAlign: "right",
          },
        ]}
      >
        {serie.ejeMax}
      </Text>
      <Text
        style={[
          s.eje,
          {
            position: "absolute",
            left: 5,
            top: 26 + abajo - 3,
            width: margen.izquierda - 3,
            textAlign: "right",
          },
        ]}
      >
        {serie.ejeMin}
      </Text>
      {fechas ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginLeft: margen.izquierda,
            marginRight: margen.derecha,
            marginTop: -9,
          }}
        >
          <Text style={s.eje}>{fechas[0]}</Text>
          <Text style={s.eje}>{fechas[1]}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Pie() {
  return (
    <View style={s.pie} fixed>
      <View style={s.pieFila}>
        <Text style={s.pieLeyenda}>{EMPRESA.leyendaPie}</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          }
        />
      </View>
      <Text>{EMPRESA.domicilioPie}</Text>
    </View>
  );
}

/** Informe de laboratorio, con la estructura del "Análisis de tendencias en aceites" de MOT. */
function InformePdf({ d }: { d: DatosPdfInforme }) {
  const hayElementos = d.grupos.some((g) => g.grupo !== "fisicoquimico");
  return (
    <Document
      title={`Informe de laboratorio ${d.folio}`}
      author={EMPRESA.razonSocial}
      language="es-MX"
    >
      <Page size="LETTER" orientation="landscape" style={s.pagina}>
        <Encabezado d={d} />
        <View style={s.bloques}>
          <Renglones titulo="Información del cliente" renglones={d.cliente} />
          <Renglones
            titulo="Información de la última muestra"
            renglones={d.ultimaMuestra}
          />
          <Renglones titulo="Información del equipo" renglones={d.equipo} />
        </View>

        <View style={s.seccion}>
          <Text style={s.tituloSeccion}>
            Tendencias y datos de las muestras
          </Text>
          {d.avisoMuestras ? (
            <Text style={s.leyenda}>{d.avisoMuestras}</Text>
          ) : null}
          <Tabla d={d} grupos={["fisicoquimico", "cualitativo"]} />
          <Text style={s.nota}>
            En rojo, los resultados que no pasan su límite. Notas:{" "}
            {NOTAS_INFORME.fisicoquimico}
          </Text>
        </View>

        {hayElementos ? (
          <View style={s.seccion} break>
            <Text style={s.tituloSeccion}>
              Elementos de desgaste, aditivos y contaminantes
            </Text>
            <Tabla d={d} grupos={["desgaste", "aditivos", "contaminantes"]} />
            <Text style={s.nota}>Notas: {NOTAS_INFORME.elementos}</Text>
          </View>
        ) : null}

        {d.graficas.length > 0 ? (
          <View style={s.seccion} break>
            <Text style={s.tituloSeccion}>Gráficas de tendencia</Text>
            <Text style={s.leyenda}>
              De la muestra más antigua a la más reciente. La línea gris es el
              límite; los puntos huecos en rojo no pasan.
            </Text>
            {d.graficas.map((g) => (
              <View key={g.titulo} style={{ marginBottom: 8 }} wrap={false}>
                <Text style={[s.tituloBloque, { marginBottom: 4 }]}>
                  {g.titulo}
                </Text>
                <View style={s.graficas}>
                  {g.series.map((serie) => (
                    <Grafica
                      key={serie.nombre}
                      serie={serie}
                      fechas={d.ejeFechas}
                    />
                  ))}
                </View>
                {g.enCero.length > 0 ? (
                  <Text style={[s.leyenda, { marginTop: 4, marginBottom: 0 }]}>
                    En cero en todas las muestras: {g.enCero.join(", ")}.
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.seccion} wrap={false}>
          <Text style={s.tituloSeccion}>Observaciones</Text>
          <Text style={s.observaciones}>
            {d.observaciones ?? "Sin observaciones."}
          </Text>
          <View style={s.firmas}>
            <View style={s.firma}>
              <Text style={s.firmaTitulo}>Elaboró</Text>
              <Text style={s.firmaNombre}>{d.elaboro}</Text>
            </View>
            <View style={s.firma}>
              <Text style={s.firmaTitulo}>Validó</Text>
              <Text style={s.firmaNombre}>{d.valido}</Text>
            </View>
          </View>
        </View>

        <Pie />
      </Page>
    </Document>
  );
}

export function generarPdfInforme(datos: DatosPdfInforme): Promise<Buffer> {
  return renderToBuffer(<InformePdf d={datos} />);
}
