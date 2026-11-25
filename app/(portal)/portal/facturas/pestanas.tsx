import Link from "next/link";

const PESTANAS = [
  { href: "/portal/facturas", label: "Facturas" },
  { href: "/portal/pagos", label: "Pagos" },
];

/** Cambia entre las facturas y los pagos del cliente. */
export function PestanasFacturacion({ actual }: { actual: string }) {
  return (
    <nav aria-label="Facturación" className="flex gap-1 border-b">
      {PESTANAS.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={p.href === actual ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            p.href === actual
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
