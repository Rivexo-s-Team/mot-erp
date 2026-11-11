# Sistema MOT

ERP a medida para **Molecular Oil Technology (MOT)**, desarrollado por **Rivexo**. MOT limpia aceite industrial en la planta de sus clientes con el SKF RecondOil Box ("Robox"), del que es el único distribuidor autorizado en México, y tiene laboratorio propio de análisis de aceite.

**Antes de diseñar o programar cualquier cosa, lee `docs/DISENO.md`.** Ahí están el negocio, el modelo de datos, las reglas, los roles, las etapas y las preguntas abiertas. Los documentos originales del cliente están en `docs/referencias/`.

## Quién trabaja aquí

Alejandro (Rivexo) dirige el proyecto. Es ingeniero mecatrónico, no programador de profesión: entiende Supabase, GitHub y bases de datos, pero explícale en español claro qué hiciste y por qué, sin jerga innecesaria. Trabaja mucho desde el celular, así que tus resúmenes deben ser breves y legibles en pantalla chica.

## Stack

- Next.js (App Router) + TypeScript estricto + React Server Components y Server Actions
- Supabase: Postgres, Auth, Storage, Edge Functions, `pg_cron`
- Tailwind CSS + shadcn/ui
- Zod para validar toda entrada; React Hook Form en formularios
- pnpm

## Reglas no negociables

1. **Nunca toques producción.** Solo el proyecto Supabase de desarrollo (`mot-dev`). Si una tarea parece requerir producción, detente y pregunta.
2. **El esquema solo cambia con migraciones** en `supabase/migrations/`. Nada de cambios manuales en el dashboard. Después de cada migración, regenera los tipos (`supabase gen types`).
3. **RLS activado en todas las tablas**, con políticas por rol desde el momento en que se crea la tabla. Precios, costos y márgenes solo los leen los roles que la matriz permite (ver DISENO §4.7).
4. **Dinero:** `numeric`, nunca `float`. Todo importe lleva `moneda` (los contratos actuales son en USD) y, cuando aplique, `tipo_cambio`.
5. **Parámetros de negocio en datos, no en código:** el 70 % y el piso de 2.5 USD/L del cotizador, los límites de laboratorio y los umbrales de condición del aceite.
6. **Secretos:** nunca en el repo. Usa variables de entorno; `.env.example` lista los nombres sin valores.
7. **Datos semilla** en `supabase/seed.sql`, con el caso real de Rassini descrito en DISENO §5 (Etapa 0). `supabase db reset` debe dejar el sistema usable.
8. **No inventes reglas de negocio.** Si algo no está en `docs/DISENO.md`, o está en "Preguntas abiertas", implementa la opción más sencilla y reversible, márcala con `// PENDIENTE(Pn):` y avisa en tu resumen.

## Convenciones

- **Dominio en español** (tablas, columnas, rutas de la app, textos de interfaz): `cuentas`, `plantas`, `ordenes_servicio`, en snake_case y sin acentos. **Código de framework en inglés** (componentes, hooks, utilidades).
- Toda la interfaz va en español de México. Fechas `dd/mm/aaaa`, zona `America/Mexico_City`; se guardan como `timestamptz`.
- Columnas estándar: `id uuid`, `created_at`, `updated_at`, `created_by`. Borrado lógico (`deleted_at`) en entidades de negocio.
- Bitácora de cambios en tablas sensibles: precios, contratos, facturas, resultados de laboratorio.
- La sección de campo (`/campo`) se diseña primero para celular y guarda el borrador localmente.
- Estructura sugerida: `app/(app)/<modulo>/…`, `app/(campo)/…`, `app/(portal)/…`, `lib/`, `components/`, `supabase/`.

## Base de datos

- Flujo: migración nueva → `pnpm db:reset` → `pnpm db:test` → `pnpm db:types`. A `mot-dev` solo llegan migraciones ya fusionadas a `main`.
- Tabla nueva: RLS activado, triggers `set_updated_at` y `set_created_by`, y `registrar_bitacora` si es sensible. Cada tabla lleva su prueba en `supabase/tests/`.
- Datos que producción necesita (parámetros, catálogos, roles) van en migraciones; `seed.sql` es solo para desarrollo.

## Acceso y permisos

- Toda página de `app/(app)` empieza con `requireSesion()` o `requirePermiso("modulo.accion")` (`lib/auth/session.ts`). Eso es comodidad de interfaz: la seguridad real son las políticas RLS con `tiene_permiso('modulo.accion')`.
- Permiso nuevo: se agrega en una migración a `permisos` y `rol_permisos`, con su caso en `supabase/tests/002_roles_permisos.test.sql`.
- `lib/supabase/admin.ts` (llave secreta) salta RLS: solo después de verificar el permiso y solo para lo que la sesión no puede hacer.
- Next 16 con Cache Components: lo que lee la sesión va dentro de `<Suspense>` (el layout de `(app)` ya envuelve las páginas). Antes de usar una API de Next, revisa `node_modules/next/dist/docs/`.

## Formularios

- Los formularios se definen como una lista de campos (`lib/forms/campos.ts`) y se pintan con `components/forms/config-form.tsx`. La misma lista valida en el navegador y en el servidor. Úsalo antes de escribir un formulario a mano.
- Entidades de negocio: no se borran, se marcan con `deleted_at` y las lecturas filtran `deleted_at is null`. Los nombres únicos usan índices parciales (solo registros vigentes).
- Precios y costos van en tabla aparte de los datos generales (ej. `equipos_cliente_costos`), con políticas `precios.ver` y bitácora. El formulario solo incluye esos campos para quien puede verlos, y el servidor vuelve a decidirlo por su cuenta.
- Lo que cuelga de una cuenta (plantas, razones sociales, contactos) lleva `cuenta_id` y llaves foráneas compuestas, para que la base impida mezclar datos de dos cuentas.

## Catálogos

- Los catálogos sencillos se definen en `lib/catalogos/config.ts` (campos, columnas, permiso de edición y validación); las pantallas de lista y edición se arman solas a partir de ahí. Para uno nuevo: migración con su tabla y RLS, y una entrada en esa configuración.
- En catálogos no se borra: se desactiva (`activo = false`).

## Interfaz

- Debe verse profesional y consistente desde la primera pantalla. Usa los componentes de shadcn/ui (`components/ui`) y los colores del tema en `app/globals.css`; no escribas colores sueltos en las páginas.
- Marca: logotipo en `components/brand/logo.tsx` (solo sobre fondo claro). Primario azul del logo; cian y verde (`marca-cian`, `marca-verde`) solo como acentos.
- Módulo nuevo: agrega su entrada al menú en `lib/navegacion.ts` con el permiso que lo hace visible. El layout de `(app)` ya pone la barra lateral (escritorio) y el menú desplegable (celular).
- Tema claro. Cada pantalla se revisa en celular (390 px) y en escritorio antes de darla por terminada.

## Forma de trabajo

- Trabaja **por etapas** (DISENO §5). No adelantes módulos de etapas futuras.
- Antes de una tarea grande, propón un plan corto y espera confirmación.
- Commits pequeños y descriptivos, en español. Una rama por tarea; PR hacia `main`.
- Antes de dar algo por terminado: `pnpm lint`, `pnpm typecheck`, las pruebas de lo que tocaste y una prueba de las políticas RLS (un usuario de cada rol ve solo lo suyo).
- Al terminar, resume en pocas líneas: qué cambió, cómo probarlo y qué quedó pendiente.

## Estado

- **Etapa 0. Cimientos: terminada**, pendiente de revisión con MOT.
- **Etapa 1. Clientes y comercial: en curso.** Plan de 6 pasos: (1) expediente del cliente, hecho; (2) equipos y requisitos de planta, hecho; (3) pipeline, hecho salvo el archivo adjunto de las etapas de muestra y resultados (D11), que requiere Storage; (4) cotizador y cotizaciones; (5) cotización en PDF; (6) cierre y carga de los 4 clientes.
- Decisiones de esta etapa en DISENO §7: D9 (vendedor externo = canal, no usuario), D10 (cotizaciones de partidas libres), D11 (ganar solo marca pendiente de contrato).
- Pendiente fuera de etapa: pantalla de bitácora; recuperación de contraseña por correo. La pantalla de parámetros de negocio va en el paso 4.
- Preguntas abiertas: DISENO §6.
