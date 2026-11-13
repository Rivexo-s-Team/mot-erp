import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CAMPOS_LECTURA,
  lecturaTieneDatos,
  type Captura,
} from "@/lib/ordenes/captura";

type Props = {
  captura: Captura;
  actividades: { id: string; nombre: string }[];
  fallas: { id: string; nombre: string }[];
};

/** Lo capturado en la visita, solo para consulta (escritorio y celular). */
export function OrdenCaptura({ captura, actividades, fallas }: Props) {
  const { inicial, posterior } = captura.lecturas;
  const hayLecturas =
    lecturaTieneDatos(inicial) || lecturaTieneDatos(posterior);
  const hechas = actividades.filter((a) => a.id in captura.actividades);
  const encontradas = fallas.filter((f) => captura.fallas.includes(f.id));
  const equipo: [string, string][] = [
    ["ID de caso", captura.id_caso],
    [
      "Reservorio",
      captura.volumen_reservorio_l ? `${captura.volumen_reservorio_l} L` : "",
    ],
    [
      "Temperatura del aceite",
      captura.temperatura_aceite_c ? `${captura.temperatura_aceite_c} °C` : "",
    ],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Servicio realizado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            {equipo.map(([nombre, valor]) => (
              <div key={nombre} className="contents">
                <dt className="text-muted-foreground">{nombre}</dt>
                <dd className="tabular-nums">{valor || "—"}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="mb-1 text-muted-foreground">Actividades</p>
            {hechas.length === 0 ? (
              <p>Ninguna marcada.</p>
            ) : (
              <ul className="list-disc space-y-0.5 pl-5">
                {hechas.map((a) => (
                  <li key={a.id}>
                    {a.nombre}
                    {captura.actividades[a.id]
                      ? ` (${captura.actividades[a.id]})`
                      : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1 text-muted-foreground">Fallas o problemas</p>
            {encontradas.length === 0 ? (
              <p>Ninguna.</p>
            ) : (
              <ul className="list-disc space-y-0.5 pl-5">
                {encontradas.map((f) => (
                  <li key={f.id}>{f.nombre}</li>
                ))}
              </ul>
            )}
          </div>
          {captura.observaciones ? (
            <div>
              <p className="mb-1 text-muted-foreground">Otros / Notas</p>
              <p className="whitespace-pre-line">{captura.observaciones}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parámetros del Robox</CardTitle>
        </CardHeader>
        <CardContent>
          {hayLecturas ? (
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-normal">Parámetro</th>
                  <th className="py-1.5 pr-3 font-normal">Inicial</th>
                  <th className="py-1.5 font-normal">Posterior</th>
                </tr>
              </thead>
              <tbody>
                {CAMPOS_LECTURA.map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <th className="py-1.5 pr-3 text-left font-normal text-muted-foreground">
                      {c.label}
                      {c.unidad ? ` (${c.unidad})` : ""}
                    </th>
                    <td className="py-1.5 pr-3 break-all">
                      {inicial[c.name] || "—"}
                    </td>
                    <td className="py-1.5 break-all">
                      {posterior[c.name] || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no se capturan lecturas.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
