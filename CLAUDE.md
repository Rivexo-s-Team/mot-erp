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
- La sección de campo (`/campo`) se diseña primero para celular y guarda el borrador localmente. Tiene su propio layout (`app/(campo)/layout.tsx`), sin menú lateral, y exige el permiso `ordenes.editar`.
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

## Captura en campo

- Lo que se captura en la visita se guarda de una sola vez con la función de base `guardar_captura_orden(orden, captura)`: reemplaza lo anterior, así que enviarla dos veces deja el mismo resultado. Respeta RLS (`puede_llenar_orden`).
- La forma de la captura, su validación y el borrador viven en `lib/ordenes/captura.ts` (sin base ni navegador, con pruebas). El formulario (`app/(campo)/campo/ordenes/[id]/captura/captura-form.tsx`) guarda cada cambio en `localStorage` (`mot:captura:<orden>`), lo envía a los pocos segundos y reintenta sin señal. Si en el teléfono hay cambios sin enviar, mandan sobre lo del sistema.
- Las firmas se guardan como trazos (puntos dentro de un lienzo de 600 × 240, `os_firmas.trazos`), no como imagen: viajan con la captura y su borrador. `components/firma-pad.tsx` las captura y `components/firma-vista.tsx` las dibuja (sirve también para el PDF).
- Las fotos (`os_evidencias`, bucket `evidencias`) sí necesitan señal: usan la subida en dos pasos de "Archivos". Las piezas compartidas de esa subida están en `lib/archivos/subida.ts`.
- Cerrar la orden lo valida la base (en curso y firmada); `components/cerrar-orden.tsx` además no deja cerrar si en el teléfono hay cambios sin enviar.
- En pruebas de navegador, la falta de señal se simula con `context.setOffline(true)`; el estado del envío está en `[role="status"][data-estado]`.

## Inventario

- La existencia de una parte no se guarda: es la suma de `inventario_movimientos` (vista `inventario_existencias`). Los movimientos solo se agregan; nunca se editan ni se borran. Un error se corrige con otro movimiento.
- El ajuste por conteo lo calcula la base (`ajustar_existencia(parte, contada)`): se indica cuántas piezas hay y registra la diferencia.
- Las partes usadas en una orden (`os_partes`) viajan con la captura. Al cerrar la orden, un trigger registra sus salidas; a mano no se puede atribuir un movimiento a una orden.

## Formularios

- Los formularios se definen como una lista de campos (`lib/forms/campos.ts`) y se pintan con `components/forms/config-form.tsx`. La misma lista valida en el navegador y en el servidor. Úsalo antes de escribir un formulario a mano.
- Next conserva ocultas las páginas ya visitadas (hasta 3) con su estado. Por eso `ConfigForm` se reinicia en cada entrada nueva (`bfcacheId`) y usa ids únicos (`useId`). Un formulario hecho a mano debe hacer lo mismo. En pruebas de navegador, apunta solo a elementos visibles.
- Importes: se calculan con enteros o en SQL (`numeric`), nunca multiplicando decimales en JavaScript. Ver `lib/cotizaciones/cotizador.ts`.
- Entidades de negocio: no se borran, se marcan con `deleted_at` y las lecturas filtran `deleted_at is null`. Los nombres únicos usan índices parciales (solo registros vigentes).
- Precios y costos van en tabla aparte de los datos generales (ej. `equipos_cliente_costos`), con políticas `precios.ver` y bitácora. El formulario solo incluye esos campos para quien puede verlos, y el servidor vuelve a decidirlo por su cuenta.
- Una función (como `validar`) no se puede pasar de una página del servidor a `ConfigForm`: se envuelve en un componente de cliente (ver `app/(app)/contratos/contrato-form.tsx`).
- Lo que cuelga de una cuenta (plantas, razones sociales, contactos) lleva `cuenta_id` y llaves foráneas compuestas, para que la base impida mezclar datos de dos cuentas.

## Archivos

- Los archivos van en buckets privados de Storage, con políticas por permiso en `storage.objects` (ver `20261111050000_archivos_comerciales.sql`). Nunca buckets públicos.
- Subida en dos pasos (`components/forms/file-uploader.tsx`): el servidor revisa el permiso y da un permiso temporal; el navegador sube directo a Storage; el servidor confirma que llegó y lo registra. Así no se topa con el límite de tamaño del servidor.
- Para abrirlos, una ruta en `app/(app)/archivos/` revisa el permiso y redirige a un enlace firmado de 60 segundos.
- Un archivo subido no se reemplaza ni se borra desde la app; quitarlo solo lo oculta.
- Para probar archivos en local, Supabase debe arrancar con Storage (`pnpm db:start`).

## PDF

- Los PDF se generan en el servidor con `@react-pdf/renderer`, en una ruta (`…/pdf/route.ts`) con los mismos permisos que la pantalla.
- Separa los datos del dibujo: una función pura arma lo que sale en el documento (`lib/cotizaciones/pdf-datos.ts`, con pruebas) y otro archivo lo dibuja (`pdf-documento.tsx`). Lo que va al cliente nunca incluye datos internos (notas, precios de referencia, costos).
- El PDF de la orden de servicio sigue el mismo patrón (`lib/ordenes/pdf-datos.ts` y `pdf-documento.tsx`, ruta `app/(app)/ordenes/[id]/pdf`). Las firmas se dibujan con `Svg` y `Polyline` a partir de sus trazos. Debe caber en una hoja carta.
- Los datos fiscales de MOT que se imprimen están en `lib/empresa.ts`. El PDF no parte palabras con guion (`Font.registerHyphenationCallback`).
- Para revisar un PDF en pruebas: `pdftotext` para el texto y `pdftoppm` para verlo como imagen.

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
- **Etapa 1. Clientes y comercial: terminada.** Plan de 6 pasos: (1) expediente del cliente, hecho; (2) equipos y requisitos de planta, hecho; (3) pipeline, hecho; (4) cotizador y cotizaciones, hecho (partidas libres, versiones, cotizador por litro y pantalla de parámetros); incluidos los archivos (adjuntos de oportunidad y comprobante del precio de referencia); (5) cotización en PDF, hecha con el formato de la cotización tipo de MOT (folio anual, precios más IVA, notas numeradas); (6) cierre: los 3 clientes actuales (GOPLAS, NACOBRE, TT Green Metals) ya están en `mot-dev` con plantas y contactos; razones sociales, equipos y demás los captura MOT. Sus 13 rentas son datos de contrato (Etapa 2).
- **Etapa 2. Flota y contratos: terminada**, pendiente de revisión con MOT. Plan de 5 pasos: (1) flota de Robox (lista, ficha, alta y edición), hecho; (2) contratos con tarifas (lista, ficha, alta desde una oportunidad ganada copiando la cotización aceptada), hecho; (3) órdenes de compra (por contrato; cada tarifa indica qué orden la cubre), hecho; (4) asignaciones, carrusel y movimientos (en la ficha del Robox; la ubicación se calcula con la vista `robox_ubicacion`), hecho; (5) cierre: las 13 rentas actuales ya están en `mot-dev` como 5 contratos vigentes (GOPLAS Lechería ×2, NACOBRE Celaya, NACOBRE SLP, TT Green Metals Guanajuato) con 13 tarifas y 12 órdenes de compra, hecho. Falta que MOT capture los Robox con su número de serie (P10) y los asigne, y que confirme las fechas de inicio (estimadas). Decisiones D18 a D23.
- **Etapa 3. Operación en campo: en curso.** Plan de 7 pasos: (1) órdenes de servicio, lo básico (encabezado, folio automático, lista en escritorio y "mis órdenes" en `/campo`), hecho; (2) captura en el celular (datos del equipo, lecturas inicial y posterior, actividades, fallas y notas) con borrador en el teléfono que se envía solo al recuperar señal, hecho; (3) fotos de la visita, firmas dibujadas (técnico y responsable del cliente) y cierre de la orden, hecho; (4) PDF de la orden con el formato "Servicio RecondOil Box" y las firmas dibujadas, hecho; (5) inventario: primera parte hecha (existencias por movimientos, entradas, salidas y ajustes por conteo; partes usadas en la orden, que salen del inventario al cerrarla); falta la segunda parte (qué filtro tiene cada Robox y alerta de cambio); (6) agenda y acceso a planta; (7) cargos (quedan como pendientes de facturar) y cierre. Decisiones D24 a D30.
- Decisiones de la Etapa 1 en DISENO §7: D9 (vendedor externo = canal, no usuario), D10 (cotizaciones de partidas libres), D11 (ganar solo marca pendiente de contrato), D12 a D17 (precios más IVA, folio CMOT, estados, comodato, renta a 3 años, contenedor, motivos de pérdida).
- Pendiente fuera de etapa: pantalla de bitácora; recuperación de contraseña por correo.
- Preguntas abiertas: DISENO §6.
