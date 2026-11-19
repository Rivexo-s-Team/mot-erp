import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  /** Ruta de la lista, p. ej. "/facturas". */
  accion: string;
  valor: string;
  placeholder: string;
  /** Otros filtros de la lista que deben conservarse al buscar. */
  conservar?: Record<string, string | undefined>;
};

/** Buscador de una lista: recarga la misma pantalla con `?q=`. */
export function Busqueda({ accion, valor, placeholder, conservar }: Props) {
  return (
    <form action={accion} className="mb-4 flex gap-2">
      {Object.entries(conservar ?? {}).map(([nombre, v]) =>
        v ? <input key={nombre} type="hidden" name={nombre} value={v} /> : null,
      )}
      <Input
        name="q"
        type="search"
        defaultValue={valor}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 max-w-sm bg-background"
      />
      <Button type="submit" variant="outline" className="h-10">
        Buscar
      </Button>
    </form>
  );
}
