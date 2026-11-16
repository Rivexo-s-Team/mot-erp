import type { Metadata } from "next";
import Link from "next/link";
import { EstadoDocumentoBadge } from "@/components/estado-documento-badge";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { revisionDeAcceso } from "@/lib/acceso/data";
import { requirePermiso, tienePermiso } from "@/lib/auth/session";
import { formatDia } from "@/lib/format";

export const metadata: Metadata = { title: "Documentos de acceso" };

export default async function DocumentosAccesoPage() {
  const sesion = await requirePermiso("documentos_acceso.ver");
  const edita = tienePermiso(sesion, "documentos_acceso.editar");
  // Un renglón por cada documento de MOT y de cada persona que va a planta.
  const renglones = await revisionDeAcceso();
  const grupos = [
    { titulo: "De MOT", filas: renglones.filter((r) => r.de === "MOT") },
    ...[...new Set(renglones.filter((r) => r.de !== "MOT").map((r) => r.de))]
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((nombre) => ({
        titulo: nombre,
        filas: renglones.filter((r) => r.de === nombre),
      })),
  ].filter((g) => g.filas.length > 0);

  return (
    <>
      <PageHeader
        title="Documentos de acceso"
        description="Lo que las plantas piden para dejar entrar: de MOT y de cada persona, con su vencimiento."
      >
        {edita ? (
          <Link
            href="/documentos-acceso/nuevo"
            className={buttonVariants({ className: "h-9" })}
          >
            Registrar documento
          </Link>
        ) : null}
      </PageHeader>

      {grupos.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          No hay tipos de documento definidos. Se agregan en Catálogos.
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {grupos.map((g) => (
            <section key={g.titulo}>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">
                {g.titulo}
              </h2>
              <ul className="space-y-2">
                {g.filas.map((r) => {
                  const tarjeta = (
                    <Card
                      className={`flex-row flex-wrap items-center justify-between gap-2 px-4 py-3 ${edita && r.documentoId ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""}`}
                    >
                      <div>
                        <p className="font-medium">{r.documento}</p>
                        <p className="text-sm text-muted-foreground">
                          {r.estado === "falta"
                            ? "Sin registrar"
                            : r.vencimiento
                              ? `Vence el ${formatDia(r.vencimiento)}`
                              : "No vence"}
                          {r.documentoId && !r.tieneArchivo
                            ? " · sin archivo"
                            : ""}
                        </p>
                      </div>
                      <EstadoDocumentoBadge estado={r.estado} />
                    </Card>
                  );
                  return (
                    <li key={r.clave}>
                      {edita && r.documentoId ? (
                        <Link
                          href={`/documentos-acceso/${r.documentoId}`}
                          className="block"
                        >
                          {tarjeta}
                        </Link>
                      ) : (
                        tarjeta
                      )}
                      {!edita && r.documentoId && r.tieneArchivo ? (
                        <a
                          href={`/archivos/documento-acceso/${r.documentoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-sm text-primary underline-offset-4 hover:underline"
                        >
                          Abrir archivo
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
