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

### Usuarios de prueba (solo base local)

`pnpm db:reset` crea un usuario por rol, todos con la contraseña `mot-local-1234`:
`direccion@mot.test`, `comercial@mot.test`, `tecnico@mot.test`, `laboratorio@mot.test`, `administracion@mot.test` y `cliente@mot.test`.

El mismo comando carga el caso real de Rassini: la cuenta, la planta BYPASA, los equipos 11B113 y 11B116 y el Robox 545592.

Para que la app use la base local, pon en `.env.local` la URL y las llaves que imprime `pnpm db:start` (`API_URL`, `PUBLISHABLE_KEY` y `SECRET_KEY`). Estos usuarios **no existen en mot-dev**.

Para un cambio de esquema:

1. `pnpm exec supabase migration new <nombre>` y escribe el SQL.
2. `pnpm db:reset`, `pnpm db:test` y `pnpm db:types`.
3. PR. Ya fusionado, la migración se aplica a mot-dev.

## Acceso y permisos

- Se entra con correo y contraseña en `/login`. No hay registro abierto: Dirección da de alta a cada persona en **Usuarios**.
- Hay 6 roles (Dirección, Comercial, Técnico, Laboratorio, Administración y Cliente). Qué puede hacer cada uno está en la tabla `rol_permisos`, no en el código.
- Los catálogos base (aceites, parámetros de laboratorio, partes, actividades y fallas) los ven todos los roles internos. Aceites y parámetros los editan Laboratorio y Dirección; partes, Administración y Dirección; actividades y fallas, solo Dirección.
- El menú muestra solo lo que el rol puede usar (`lib/navegacion.ts`). Los usuarios del rol Cliente entran directo a `/portal` y no ven el sistema interno.
- Clientes (cuentas, plantas, razones sociales y contactos) los consultan todos los roles internos. Dirección y Comercial los editan; Administración edita además las razones sociales.
- Cada planta tiene su página con equipos y requisitos de acceso. El costo del aceite virgen de cada equipo solo lo ven Dirección, Comercial y Administración.
- El pipeline (oportunidades, actividades y canales de venta) lo ven y editan solo Dirección y Comercial. Los vendedores externos son canales de venta, no usuarios.
- Las órdenes de servicio (`/ordenes`) las ven todos los roles internos; las crean y llenan Técnico y Dirección. El técnico solo cambia las suyas. `/campo` es la vista para celular con las órdenes del técnico.
- Con la orden en curso, el técnico captura la visita desde `/campo` en su celular. Cada cambio se guarda en el teléfono y se envía solo; si no hay señal, se envía al recuperarla.
- La orden se cierra desde `/campo` cuando ya tiene las firmas (técnico y, en una visita, responsable del cliente). También se le agregan fotos. Una orden cerrada ya no se puede cambiar.
- La flota de Robox (`/flota`) la ven todos los roles internos; la editan Dirección y Técnico. El número de serie no se repite entre equipos vigentes.
- En la ficha de cada Robox se le asigna un contrato, se indican los tanques que atiende (carrusel) y se registran sus movimientos. Con eso el sistema calcula dónde está cada Robox.
- Los contratos (`/contratos`) los ven todos los roles internos y los editan Dirección y Administración. Sus tarifas son precios: solo las ven Dirección, Comercial y Administración.
- Las órdenes de compra del cliente se registran en la ficha del contrato y siguen la misma regla que las tarifas (son precios).
- Las cotizaciones son precios: solo las ven Dirección y Comercial. Una cotización enviada ya no se edita; los cambios van en una versión nueva. El porcentaje y el precio mínimo del cotizador se cambian en Parámetros (solo Dirección).
- Archivos (adjuntos de oportunidad y comprobantes de precio): se guardan en espacios privados; solo los abren Dirección y Comercial, con un enlace que dura un minuto. PDF o imagen, hasta 10 MB.
- Las cotizaciones llevan folio anual `CMOT AAAA-NNN`, 15 días de vigencia por defecto y estados borrador, enviada, aceptada y rechazada. Los precios son más IVA.
- Cada cotización se puede ver como PDF para el cliente (botón Ver PDF). Lleva partidas, totales y condiciones; no lleva notas internas ni el precio de referencia del aceite. Mientras está en borrador, el PDF lo indica.
- La protección real está en la base (políticas RLS). La app solo oculta lo que el usuario no puede usar.
- `supabase/tests/002_roles_permisos.test.sql` comprueba que cada rol ve solo lo suyo.

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
2. En **Environment Variables**, agrega estas tres con los valores de **mot-dev**, para los tres ambientes (_Production_, _Preview_ y _Development_):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (márcala como _Sensitive_)
3. Mientras no exista `mot-prod`, _Production_ (lo que se despliega desde `main`) también apunta a mot-dev. Cuando MOT salga en vivo, solo se cambian los valores de _Production_ por los de `mot-prod`. Después de cambiar variables hay que volver a desplegar (**Deployments → ⋯ → Redeploy**).

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
