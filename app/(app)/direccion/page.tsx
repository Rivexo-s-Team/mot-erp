import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarrasMensuales } from "@/components/direccion/barras-mensuales";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermiso } from "@/lib/auth/session";
import {
  ingresosPorMes,
  porFacturar,
  porPlanta,
  rentasVigentes,
} from "@/lib/direccion/data";
import {
  cuentasDeMoneda,
  finDeMes,
  nombreMesLargo,
  saldosPorCuenta,
  seriesPorMoneda,
  ultimosMeses,
  type CuentaDelTablero,
} from "@/lib/direccion/tablero";
import {
  antiguedadDeSaldos,
  diasDeAtraso,
  totalesPorMoneda,
} from "@/lib/facturacion/cobranza";
import { facturasPorCobrar } from "@/lib/facturacion/data";
import { formatImporte, hoyEnMexico } from "@/lib/format";

export const metadata: Metadata = { title: "Dirección" };

const MESES = 12;

export default async function DireccionPage() {
  await requirePermiso("direccion.ver");
  const hoy = hoyEnMexico();
  const meses = ultimosMeses(hoy, MESES);
  const mesActual = meses.at(-1)!;
  const mesAnterior = meses.at(-2)!;
  const [ingresos, rentas, pendientes, porCobrar, plantas] = await Promise.all([
    ingresosPorMes(meses[0]!, finDeMes(mesActual)),
    rentasVigentes(),
    porFacturar(),
    facturasPorCobrar(),
    porPlanta(meses[0]!, finDeMes(mesActual)),
  ]);
  const saldos = saldosPorCuenta(
    porCobrar.map((f) => ({
      cuenta_id: f.cuenta_id,
      cuenta: f.cuentas?.nombre ?? "—",
      moneda: f.moneda,
      saldo: f.saldos.saldo,
      vencida: diasDeAtraso(f, hoy) > 0,
    })),
  );
  const series = seriesPorMoneda(ingresos, meses);
  const cartera = totalesPorMoneda(
    antiguedadDeSaldos(
      porCobrar.map((f) => ({ ...f, saldo: f.saldos.saldo })),
      hoy,
    ),
  );
  // Las monedas con algo que mostrar. Nunca se suman entre sí.
  const monedas = [
    ...new Set([
      ...series.map((s) => s.moneda),
      ...rentas.map((r) => r.moneda),
      ...pendientes.map((p) => p.moneda),
      ...cartera.map((c) => c.moneda),
      ...plantas.map((p) => p.moneda),
    ]),
  ].sort();

  return (
    <>
      <PageHeader
        title="Dirección"
        description="Ingresos y cobranza con lo que ya está capturado. Cada moneda va por separado; nada se convierte."
      />

      {monedas.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          Aún no hay contratos vigentes, cargos ni facturas que mostrar.
        </Card>
      ) : null}

      <div className="space-y-10">
        {monedas.map((moneda) => {
          const serie = series.find((s) => s.moneda === moneda);
          const actual = serie?.meses.at(-1);
          const anterior = serie?.meses.at(-2);
          const renta = rentas.find((r) => r.moneda === moneda);
          const pendiente = pendientes.find((p) => p.moneda === moneda);
          const saldo = cartera.find((c) => c.moneda === moneda);
          const importe = (n: number | undefined) =>
            formatImporte(n ?? 0, moneda);
          const cuentas = cuentasDeMoneda(plantas, saldos, moneda);
          return (
            <section key={moneda} aria-label={`Cifras en ${moneda}`}>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">
                {moneda === "USD"
                  ? "Dólares (USD)"
                  : moneda === "MXN"
                    ? "Pesos (MXN)"
                    : moneda}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Cifra
                  titulo={`Facturado en ${nombreMesLargo(mesActual)}`}
                  valor={importe(actual?.facturado)}
                  nota={`Sin IVA · ${actual?.facturas ?? 0} ${actual?.facturas === 1 ? "factura" : "facturas"}. ${nombreMesLargo(mesAnterior)}: ${importe(anterior?.facturado)}`}
                  href="/facturas"
                />
                <Cifra
                  titulo={`Cobrado en ${nombreMesLargo(mesActual)}`}
                  valor={importe(actual?.cobrado)}
                  nota={`${nombreMesLargo(mesAnterior)}: ${importe(anterior?.cobrado)}`}
                  href="/pagos"
                />
                <Cifra
                  titulo="Renta mensual vigente"
                  valor={importe(renta?.renta_mensual)}
                  nota={
                    renta
                      ? `Sin IVA · ${renta.rentas} ${renta.rentas === 1 ? "renta" : "rentas"} en ${renta.contratos} ${renta.contratos === 1 ? "contrato" : "contratos"}`
                      : "Sin contratos de renta vigentes"
                  }
                  href="/contratos"
                />
                <Cifra
                  titulo="Por cobrar"
                  valor={importe(saldo?.total)}
                  nota={
                    saldo && saldo.vencido > 0 ? (
                      <span className="text-destructive">
                        Vencido: {importe(saldo.vencido)}
                      </span>
                    ) : (
                      "Nada vencido"
                    )
                  }
                  href="/cobranza"
                />
                <Cifra
                  titulo="Por facturar"
                  valor={importe(pendiente?.importe)}
                  nota={
                    pendiente
                      ? `Sin IVA · ${pendiente.cargos} ${pendiente.cargos === 1 ? "cargo" : "cargos"}${pendiente.por_completar > 0 ? ` · ${pendiente.por_completar} por completar` : ""}`
                      : "Sin cargos pendientes"
                  }
                  href="/cargos"
                />
              </ul>

              {serie ? (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>
                      Facturado y cobrado por mes
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        últimos {MESES} meses · {moneda}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarrasMensuales meses={serie.meses} moneda={moneda} />
                    <p className="mt-3 text-sm text-muted-foreground">
                      Las dos series llevan IVA para poder compararlas. Lo
                      cobrado es el dinero que entró en el mes, de la factura
                      que sea.
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {cuentas.length > 0 ? (
                <PorCliente cuentas={cuentas} moneda={moneda} meses={MESES} />
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Una cifra del tablero, con su nota y el enlace a la pantalla de donde sale. */
function Cifra({
  titulo,
  valor,
  nota,
  href,
}: {
  titulo: string;
  valor: string;
  nota: ReactNode;
  href: string;
}) {
  return (
    <li>
      <Link href={href} className="block h-full">
        <Card className="h-full gap-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
          <p className="text-sm text-muted-foreground">{titulo}</p>
          <p className="text-xl font-semibold tabular-nums">{valor}</p>
          <p className="text-sm text-muted-foreground">{nota}</p>
        </Card>
      </Link>
    </li>
  );
}

/**
 * Ingresos por cliente y planta. En escritorio, tabla; en celular, una
 * tarjeta por cliente. El saldo es del cliente completo.
 */
function PorCliente({
  cuentas,
  moneda,
  meses,
}: {
  cuentas: CuentaDelTablero[];
  moneda: string;
  meses: number;
}) {
  const importe = (n: number) => formatImporte(n, moneda);
  const robox = (n: number) => (n === 0 ? "—" : String(n));
  const cobrar = (c: CuentaDelTablero) =>
    c.saldo > 0 ? (
      <>
        {importe(c.saldo)}
        {c.vencido > 0 ? (
          <span className="block text-xs font-normal text-destructive">
            vencido {importe(c.vencido)}
          </span>
        ) : null}
      </>
    ) : (
      "—"
    );
  const numero = "px-4 py-2 text-right tabular-nums whitespace-nowrap";

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>
          Por cliente y planta
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {moneda} · sin IVA
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Celular: una tarjeta por cliente */}
        <ul className="space-y-3 lg:hidden">
          {cuentas.map((c) => (
            <li key={c.cuenta_id} className="rounded-lg border p-3 text-sm">
              <Link
                href={`/clientes/${c.cuenta_id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {c.cuenta}
              </Link>
              <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 tabular-nums">
                <dt className="text-muted-foreground">
                  Facturado en {meses} meses
                </dt>
                <dd className="text-right font-medium">
                  {importe(c.facturado)}
                </dd>
                <dt className="text-muted-foreground">Renta mensual</dt>
                <dd className="text-right">{importe(c.renta_mensual)}</dd>
                <dt className="text-muted-foreground">Robox</dt>
                <dd className="text-right">{robox(c.robox)}</dd>
                <dt className="text-muted-foreground">Por cobrar</dt>
                <dd className="text-right">{cobrar(c)}</dd>
              </dl>
              {c.plantas.length > 1 ? (
                <ul className="mt-2 space-y-0.5 border-t pt-2 text-muted-foreground">
                  {c.plantas.map((p) => (
                    <li
                      key={p.planta_id ?? "sin"}
                      className="flex justify-between gap-3 tabular-nums"
                    >
                      <span>{p.planta}</span>
                      <span>{importe(p.facturado)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  {c.plantas[0]?.planta ?? "Sin contrato vigente"}
                </p>
              )}
            </li>
          ))}
        </ul>

        {/* Escritorio: tabla */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">
                  Cliente y planta
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Robox
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Renta mensual
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Facturado en {meses} meses
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Por cobrar
                </th>
              </tr>
            </thead>
            {cuentas.map((c) => (
              <tbody key={c.cuenta_id} className="border-b last:border-b-0">
                <tr className="font-medium">
                  <th scope="row" className="px-4 py-2 text-left font-medium">
                    <Link
                      href={`/clientes/${c.cuenta_id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {c.cuenta}
                    </Link>
                  </th>
                  <td className={numero}>{robox(c.robox)}</td>
                  <td className={numero}>{importe(c.renta_mensual)}</td>
                  <td className={numero}>{importe(c.facturado)}</td>
                  <td className={numero}>{cobrar(c)}</td>
                </tr>
                {c.plantas.map((p) => (
                  <tr
                    key={p.planta_id ?? "sin"}
                    className="text-muted-foreground"
                  >
                    <th
                      scope="row"
                      className="py-1.5 pr-4 pl-8 text-left font-normal"
                    >
                      {p.planta}
                    </th>
                    <td className={numero}>{robox(p.robox)}</td>
                    <td className={numero}>{importe(p.renta_mensual)}</td>
                    <td className={numero}>{importe(p.facturado)}</td>
                    <td className={numero} />
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Robox y renta mensual son los de hoy; lo facturado es de los últimos{" "}
          {meses} meses. El saldo por cobrar es del cliente completo y lleva
          IVA. La rentabilidad por planta llegará con el registro de costos.
        </p>
      </CardContent>
    </Card>
  );
}
