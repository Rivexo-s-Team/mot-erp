# Sistema MOT

ERP a medida para Molecular Oil Technology (MOT), desarrollado por Rivexo.

- Diseño, modelo de datos y etapas: [`docs/DISENO.md`](docs/DISENO.md)
- Reglas de trabajo del repo: [`CLAUDE.md`](CLAUDE.md)

## Requisitos

- Node.js 22 o superior
- pnpm 10
- Docker (para Supabase local, a partir del paso 2 de la Etapa 0)

## Arranque local

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

Llena `.env.local` con los valores del proyecto **mot-dev** y luego:

```bash
pnpm dev
```

La app queda en http://localhost:3000.

## Comandos

| Comando          | Qué hace                           |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Servidor de desarrollo             |
| `pnpm build`     | Compilación de producción          |
| `pnpm lint`      | Revisa el estilo y errores comunes |
| `pnpm typecheck` | Revisa los tipos de TypeScript     |
| `pnpm test`      | Corre las pruebas (Vitest)         |
| `pnpm format`    | Da formato al código (Prettier)    |

Cada PR corre lint, typecheck, pruebas y build en GitHub Actions (`.github/workflows/ci.yml`).

## Base de datos

El esquema solo cambia con migraciones en `supabase/migrations/`. Todo se prueba primero en un Supabase local (necesita Docker abierto) y después se aplica a **mot-dev**.

| Comando         | Qué hace                                                    |
| --------------- | ----------------------------------------------------------- |
| `pnpm db:start` | Levanta Supabase local (la primera vez descarga imágenes)   |
| `pnpm db:reset` | Borra la base local y la reconstruye con migraciones y seed |
| `pnpm db:test`  | Corre las pruebas de base de datos (`supabase/tests/`)      |
| `pnpm db:types` | Regenera `lib/database.types.ts` a partir de la base local  |
| `pnpm db:stop`  | Apaga Supabase local                                        |

Para un cambio de esquema:

1. `pnpm exec supabase migration new <nombre>` y escribe el SQL.
2. `pnpm db:reset`, `pnpm db:test` y `pnpm db:types`.
3. PR. Ya fusionado, la migración se aplica a mot-dev.

## Variables de entorno

Los nombres están en [`.env.example`](.env.example). Los valores nunca se suben al repo.

| Variable                               | Dónde se usa         | Qué es                                                        |
| -------------------------------------- | -------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Navegador y servidor | URL del proyecto Supabase (`https://<ref>.supabase.co`)       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Navegador y servidor | Llave publicable (`sb_publishable_…`). RLS protege los datos. |
| `SUPABASE_SECRET_KEY`                  | Solo servidor        | Llave secreta (`sb_secret_…`). Salta RLS: nunca al navegador. |
| `SUPABASE_PROJECT_REF`                 | Solo CLI de Supabase | Referencia del proyecto. La app no la necesita.               |

Los valores están en Supabase, en **Project Settings → API Keys**.

## Despliegue de previsualización (Vercel)

1. En Vercel, **Add New → Project** e importa `Rivexo-s-Team/mot-erp`. Vercel detecta Next.js y pnpm; no hay que cambiar comandos.
2. En **Environment Variables**, agrega estas tres con los valores de **mot-dev**, para los ambientes _Preview_ y _Development_:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (márcala como _Sensitive_)
3. Deja el ambiente _Production_ sin variables por ahora: producción usará `mot-prod` y se configura cuando MOT salga en vivo.

Con eso, cada PR recibe su propia URL de previsualización.

## Estructura

```
app/(app)/      Sistema interno, por módulo
app/(campo)/    Captura de campo (/campo), primero para celular
app/(portal)/   Portal de clientes (/portal)
components/     Componentes de interfaz (components/ui = shadcn/ui)
lib/            Utilidades: variables de entorno, formato de fechas e importes
supabase/       Migraciones, datos semilla y pruebas de base de datos
docs/           Diseño y documentos de referencia del cliente
```
