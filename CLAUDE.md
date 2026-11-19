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

1. **Cuidado con los datos reales.** El único proyecto Supabase es `mot-dev` y, por decisión de Alejandro (19 nov 2026), es el que MOT usa para trabajar: trátalo como producción. Ahí solo se aplican migraciones ya fusionadas a `main` y cuando Alejandro lo pide; nunca se borran ni se cambian datos de clientes sin preguntar. Las pruebas van en la base local.
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

## Agenda

- Una visita programada es una orden de servicio en estado `programada`; no hay tabla aparte para eso. La pantalla `/agenda` las agrupa por día.
- Las visitas recurrentes de un contrato están en `visitas_programadas` (cada cuánto y cuándo toca la siguiente). Programarlas es la función de base `programar_visita(visita)`: crea la orden y avanza la fecha, todo o nada, con los permisos de quien la llama. No hay tarea automática que cree órdenes.

## Acceso a planta

- Los tipos de documento son un catálogo (`tipos_documento_acceso`: de MOT o por persona). Los documentos (`documentos_acceso`) llevan vencimiento opcional y un archivo que se sube una sola vez (bucket `documentos-acceso`); renovar es registrar otro, y cuenta el que vence más tarde.
- El estado (vigente, por vencer, vencido, falta) se calcula en `lib/acceso/documentos.ts` (sin base, con pruebas) con el parámetro `documento_aviso_dias`.
- `components/acceso-planta.tsx` se muestra en las órdenes de visita programadas o en curso: requisitos de la planta (`requisitos_planta`, categoría `acceso_planta`) y documentos de MOT, del técnico y del acompañante. Solo avisa; no impide iniciar la orden.

## Cargos

- Un cargo (`cargos`) es algo por facturar al cliente. Son importes: políticas con `cargos.ver`/`cargos.editar` y además `precios.ver`, con bitácora. El importe lo calcula la base (columna generada).
- Al cerrar una orden de un contrato `por_evento`, un trigger crea el cargo `evento_litro`: volumen del reservorio (el anotado en la visita o el del equipo) × tarifa por litro (la del equipo o la general del contrato). Si falta un dato, el cargo nace "por completar" y lo dice en sus notas.
- El estado `facturado` lo pone la factura al registrarse como emitida; a mano solo se pasa entre `pendiente` y `cancelado`.
- Rentas: cada tarifa mensual (`unidad = 'mes'`) de un contrato vigente da un cargo `renta` por mes (`cargos.tarifa_id` y `cargos.periodo`, el primer día del mes). Qué rentas le tocan a un mes lo decide la base (`rentas_del_mes(periodo)`), y `generar_rentas_mes(periodo)` crea las que falten sin duplicar. Se pide desde `/cargos/rentas`; no hay tarea automática. El mes incompleto se cobra completo y el cargo lo avisa.
- Los tipos que genera el sistema (`renta`, `pago_unico`, `evento_litro`) no se capturan a mano (`TIPOS_GENERADOS` en `lib/cargos/campos.ts`).

## Inventario

- La existencia de una parte no se guarda: es la suma de `inventario_movimientos` (vista `inventario_existencias`). Los movimientos solo se agregan; nunca se editan ni se borran. Un error se corrige con otro movimiento.
- El ajuste por conteo lo calcula la base (`ajustar_existencia(parte, contada)`): se indica cuántas piezas hay y registra la diferencia.
- Los filtros de cada Robox están en `filtros_instalados` (solo partes con `es_filtro`). Al cerrar una orden con Robox que usó un filtro, un trigger retira el anterior e instala el nuevo. La alerta de cambio se calcula en `lib/flota/filtros.ts` (sin base, con pruebas) con el parámetro `filtro_cambio_meses` y la última lectura de "filter used".
- Las partes usadas en una orden (`os_partes`) viajan con la captura. Al cerrar la orden, un trigger registra sus salidas; a mano no se puede atribuir un movimiento a una orden.

## Laboratorio

- Una muestra (`muestras`) es un frasco de aceite de un equipo del cliente. Su ID (`AAMMDD-NNN`: fecha de muestreo + consecutivo del año) lo genera la base si llega vacío; el laboratorio puede escribir el de una muestra anterior al sistema y el consecutivo sigue del mayor de ese año.
- Se puede ligar a una orden de servicio o a una oportunidad del mismo cliente (llaves compuestas). La planta sale del equipo. Campos, validación y estados en `lib/laboratorio/muestras.ts` (sin base, con pruebas).
- Un resultado (`muestra_resultados`) guarda lo que escribió el laboratorio (`valor_texto`: "0.583", "<300", "No detectado", "18/16/13"); el número y su `<` o `>` los calcula la base (columnas generadas). Se guardan todos de una vez con `guardar_resultados_muestra(muestra, {parametro: texto})`: reemplaza lo anterior y no toca lo que no cambió. Cómo se escribe un valor se valida en `lib/laboratorio/resultados.ts` (sin base, con pruebas).
- Qué parámetros pide cada nivel de análisis son casillas del catálogo de parámetros (`en_basico`, `en_basico_mpc`, `en_extendido`, `en_premium`). Solo avisa: se puede capturar cualquier parámetro.
- Pasa / no pasa y las condiciones (del aceite y de aditivos) no se guardan: se calculan al mostrar, en `lib/laboratorio/evaluacion.ts` (sin base, con pruebas que reproducen el FOLAB-26-092). Usa el límite del catálogo, la viscosidad nominal del aceite del equipo y la muestra virgen más reciente del equipo. Qué parámetros cuentan para cada condición es la columna `cuenta_para` del catálogo; los umbrales son parámetros de negocio (`umbrales_condicion_aceite()` los da a quien ve el laboratorio).
- Un informe (`informes` + `informe_muestras`) reúne muestras de un mismo equipo. `lib/laboratorio/informe.ts` (sin base, con pruebas) arma lo que dice: una columna por muestra, un renglón por parámetro, condiciones y desviación. En borrador se calcula al mostrar; al validar, esa misma estructura se guarda fija en `informes.contenido` y el informe ya no cambia (lo protege un trigger). Reabrirlo borra la validación. Lo que se muestre o imprima de un informe sale siempre de `contenidoDeInforme()`.
- Gráficas de tendencia: una pequeña por parámetro (sus escalas son muy distintas; nunca dos ejes en una gráfica). `lib/laboratorio/graficas.ts` (sin base, con pruebas) saca las series del contenido del informe y calcula escala y posiciones; `components/informe-graficas.tsx` las dibuja como SVG con los colores del tema. El PDF debe usar la misma geometría (`trazar`).
- El informe puede recomendar el cambio de filtro (`informes.recomienda_cambio_filtro`). Validado, cuenta como motivo de la alerta del Robox que tiene ese equipo en su carrusel (`recomendacionesDeLaboratorio` en `lib/flota/data.ts`, `recomendacionVigente` en `lib/flota/filtros.ts`) hasta que se le instala un filtro.
- En la oportunidad, `avisoDeMuestras` (`lib/pipeline/campos.ts`) sugiere cuándo mover la etapa según sus muestras; el sistema no la mueve solo.
- Permisos `laboratorio.ver` (todos los internos), `laboratorio.editar` (Laboratorio y Dirección) y `laboratorio.validar` (los mismos; validar y reabrir informes). Pantallas en `app/(app)/laboratorio/muestras`; `components/muestras-seccion.tsx` las muestra en la orden y en la oportunidad.

## Facturación

- Por ahora la factura se timbra fuera del sistema y aquí se registra a mano (folio, UUID, XML y PDF). Todo lo demás se construye de modo que, cuando haya PAC, solo se sustituya ese paso manual por el timbrado (P8). Nunca se timbra una factura real sin preguntar antes.
- Permisos de la etapa: `facturacion.ver` (Dirección, Administración y Comercial) y `facturacion.editar` (Dirección y Administración). Técnico y Laboratorio no ven nada de facturación.
- Condiciones de crédito (`condiciones_credito`, una por razón social, con bitácora): días de crédito, si exige orden de compra, método y forma de pago del SAT, contacto de cuentas por pagar y portal. Campos, validación (con PPD la forma de pago es 99) y `fechaVencimiento` en `lib/facturacion/credito.ts` (sin base, con pruebas). Se capturan desde la ficha del cliente, bajo cada razón social.
- Facturas (`facturas` + `factura_conceptos`, con bitácora): se arman con `crear_factura(razon_social, cargos[])`, todo o nada, a partir de cargos pendientes y completos de una misma cuenta y moneda. Cada cargo es un concepto (sus datos se copian) y queda tomado (`cargos.factura_id`): no entra en dos facturas ni cambia mientras esté en una; quitar el concepto o eliminar el borrador lo libera. Eso lo hacen triggers, no la app. Importe e IVA por concepto son columnas generadas; los totales, la vista `factura_totales` (se consulta aparte: no se puede anidar en la consulta de facturas). La tasa de IVA es el parámetro `iva_tasa`.
- En un borrador se corrigen el encabezado (fecha, tipo de cambio, método y forma de pago, uso de CFDI, días de crédito, orden de compra) y, por concepto, la descripción y las claves del SAT; cantidad y precio se corrigen en el cargo. `faltantesParaTimbrar` (`lib/facturacion/facturas.ts`, sin base, con pruebas) dice qué le falta.
- Registro de la emitida: con serie, folio, folio fiscal (`uuid_fiscal`, único), fecha y tipo de cambio la factura pasa a `emitida` (`timbrado = 'manual'`) y sus cargos a `facturado`; lo hace el trigger `facturas_proteger`, que también decide qué cambia en cada estado. Emitida solo admite corregir esos datos (mientras no tenga XML), recibir su XML y su PDF una vez cada uno (bucket `facturas`) o cancelarse con motivo; cancelada no cambia y sus cargos vuelven a pendientes y libres. Cuando haya PAC, el timbrado llenará esos mismos campos con `timbrado = 'pac'`.
- El XML que se sube se lee (`lib/facturacion/cfdi.ts`, sin base, con pruebas): debe traer el mismo folio fiscal, RFC y moneda que la factura; si su total difiere del del sistema, la ficha lo avisa (`facturas.xml_total`).
- Pagos (`pagos` + `pago_aplicaciones`, con bitácora): un pago es de una razón social y una moneda, y se aplica a sus facturas emitidas de esa misma moneda, completo o en partes; lo que sobra queda por aplicar. `registrar_pago(razon_social, datos, aplicaciones)` lo hace todo o nada. Los triggers impiden pasarse del pago o del saldo de la factura, cancelar una factura con pagos y bajar el monto de un pago por debajo de lo aplicado; eliminar un pago quita sus aplicaciones. Saldos en las vistas `factura_saldos` y `pago_saldos` (se consultan aparte). El complemento de pago (REP) se registra a mano en el pago (`rep_folio`, `rep_uuid`).
- Los importes de un pago viajan como texto hasta la base, que es la que suma (`leerPago` en `lib/facturacion/pagos.ts`, sin base, con pruebas). El formulario de pago es HTML simple que envía a una acción; si algo no procede vuelve con el motivo en `?error=`.
- Pagos únicos del contrato (tarifas `unidad = 'unico'`, D20): `pagos_unicos_de_contrato(contrato)` los lista con su cargo y `generar_cargo_unico(tarifa)` lo crea una sola vez, si el contrato está vigente. La tarifa marcada `es_anticipo` da un cargo `anticipo`; las demás, `pago_unico`. Se generan desde la ficha del contrato.
- Anticipos: el anticipo se factura aparte (`facturas.es_anticipo`, lo decide el primer concepto; un trigger impide mezclarlo con otros cargos) y se cobra como cualquier factura. Aplicarlo es un pago sin dinero nuevo: forma `30` ligada a su factura de anticipo (`pagos.anticipo_factura_id`), creado con `aplicar_anticipo(anticipo, factura, monto, fecha)`. Solo se aplica lo que el cliente ya pagó del anticipo, a la misma razón social y moneda (vista `anticipo_saldos`: pagado, aplicado, disponible). El CFDI de egreso de la aplicación se registra en los mismos campos `rep_folio`/`rep_uuid` del pago. `nombreFormaPago` (`lib/facturacion/pagos.ts`) nombra la forma 30, que nunca se ofrece al registrar un pago con dinero.
- Cobranza (D48): nada de esto se guarda, se calcula al consultar. `/cobranza` muestra las facturas emitidas con saldo y la antigüedad por razón social y moneda (`antiguedadDeSaldos`, `diasDeAtraso` y `TRAMOS` en `lib/facturacion/cobranza.ts`, sin base, con pruebas; suma en centavos). El saldo de cada orden de compra es la vista `orden_compra_saldos` (monto menos lo facturado sin IVA en facturas emitidas, por `cargos.orden_compra_id`); el contrato avisa si se excedió, no lo impide.
- Portal de proveedores (`portal_proveedor`, una fila por factura emitida, con bitácora): estado, fechas y notas capturados a mano desde la ficha de la factura (`/facturas/[id]/portal`). No hay conexión con ningún portal.
- Subidas con tipos distintos a PDF e imágenes: `validarArchivo(meta, aceptados)`, `permisoTemporal(…, aceptados)` y la propiedad `aceptados` de `FileUploader` (`ARCHIVOS_XML`, `ARCHIVOS_PDF` en `lib/archivos/config.ts`).

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
- El PDF del informe de laboratorio (`lib/laboratorio/pdf-datos.ts` y `pdf-documento.tsx`, ruta `app/(app)/laboratorio/informes/[id]/pdf`) va en hoja carta horizontal y sale de `contenidoDeInforme()`: validado, de su copia fija; en borrador lo advierte. Imprime como máximo las 8 muestras más recientes. Las gráficas usan `trazar` de `lib/laboratorio/graficas.ts`. La fuente del PDF (Helvetica) no trae letras griegas como Δ: las etiquetas de los ejes van como `Text` encima del `Svg`.
- Los datos fiscales de MOT que se imprimen están en `lib/empresa.ts`. El PDF no parte palabras con guion (`Font.registerHyphenationCallback`).
- Para revisar un PDF en pruebas: `pdftotext` para el texto y `pdftoppm` para verlo como imagen.

## Catálogos

- Los catálogos sencillos se definen en `lib/catalogos/config.ts` (campos, columnas, permiso de edición y validación); las pantallas de lista y edición se arman solas a partir de ahí. Para uno nuevo: migración con su tabla y RLS, y una entrada en esa configuración.
- En catálogos no se borra: se desactiva (`activo = false`).

## Interfaz

- Debe verse profesional y consistente desde la primera pantalla. Usa los componentes de shadcn/ui (`components/ui`) y los colores del tema en `app/globals.css`; no escribas colores sueltos en las páginas.
- Marca: logotipo en `components/brand/logo.tsx` (solo sobre fondo claro). Primario azul del logo; cian y verde (`marca-cian`, `marca-verde`) solo como acentos.
- Módulo nuevo: agrega su entrada al menú en `lib/navegacion.ts` con el permiso que lo hace visible. El layout de `(app)` ya pone la barra lateral (escritorio) y el menú desplegable (celular).
- Colores de estado: un solo código en todo el sistema (`lib/estados.ts`, con pruebas): verde = terminado o al corriente, ámbar = pendiente, rojo = vencido o crítico, azul = en proceso o previsto, gris = borrador o cancelado. Usa `components/estado-badge.tsx` (o las variantes `exito`, `aviso` y `neutro` de `Badge`); un estado nuevo se agrega a ese mapa.
- Inicio (`app/(app)/page.tsx`) es un tablero: "Por atender" sale de `conteosDeInicio` (`lib/inicio/data.ts`, cada conteo solo si el rol ve ese módulo; quien llena órdenes sin administrarlas ve las suyas) y `pendientes` (`lib/inicio/pendientes.ts`, sin base, con pruebas). Un módulo nuevo con algo que atender agrega ahí su tarjeta.
- Ruta de navegación: las fichas no llevan botón de "regresar"; pasan `migas` a `PageHeader` (de lo general a lo particular, sin la pantalla actual). Los botones del encabezado son solo acciones.
- Listas: en celular son tarjetas; en escritorio, tabla (`components/tabla-lista.tsx`, que solo se muestra desde `lg`; las tarjetas llevan `lg:hidden`). El buscador es `components/busqueda.tsx` (formulario que recarga con `?q=`) y se filtra en el servidor con `coincide` (`lib/buscar.ts`, sin acentos ni mayúsculas, con pruebas). En pruebas de navegador hay dos versiones de cada lista: apunta a la visible.
- Tablero de oportunidades: quien edita arrastra una tarjeta a otra etapa (`app/(app)/oportunidades/tablero-arrastre.tsx`, acción `moverEtapa`). Soltarla en "Perdida" lleva a su ficha, porque ahí se captura el motivo. En celular no hay arrastre: se cambia desde la ficha.
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
- **Etapa 3. Operación en campo: terminada**, pendiente de probarse en una visita real con MOT. Plan de 7 pasos: (1) órdenes de servicio, lo básico (encabezado, folio automático, lista en escritorio y "mis órdenes" en `/campo`), hecho; (2) captura en el celular (datos del equipo, lecturas inicial y posterior, actividades, fallas y notas) con borrador en el teléfono que se envía solo al recuperar señal, hecho; (3) fotos de la visita, firmas dibujadas (técnico y responsable del cliente) y cierre de la orden, hecho; (4) PDF de la orden con el formato "Servicio RecondOil Box" y las firmas dibujadas, hecho; (5) inventario, hecho: existencias por movimientos (entradas, salidas y ajustes por conteo), partes usadas en la orden que salen del inventario al cerrarla, y filtros instalados en cada Robox con alerta de cambio; (6) agenda y acceso a planta, hecho: pantalla Agenda con las órdenes por día y visitas recurrentes por contrato (al programarse crean la orden y avanzan su fecha); documentos de acceso de MOT y del personal con vencimiento y archivo, y en cada orden de visita la tarjeta "Acceso a planta" con los requisitos de la planta y el estado de esos documentos; (7) cargos por facturar, hecho: al cerrar una orden de un contrato por evento nace el cargo (reservorio × tarifa por litro), el daño por mal uso se cobra con un cargo que genera una persona, y hay captura a mano; quedan pendientes de facturar hasta la Etapa 5. Decisiones D24 a D34. En noviembre de 2026 MOT compartió un manual corporativo de procesos (propuesta de un consultor, por validar): lo que implica está en DISENO §8 y en las preguntas P12 a P16.
- **Etapa 4. Laboratorio: terminada**, pendiente de que el laboratorio la valide contra su Excel. Plan de 6 pasos: (1) muestras (registro con ID automático, tipo, equipo, fechas, nivel de análisis y estado; ligadas a la orden o a la oportunidad), hecho; (2) captura de resultados (un renglón por parámetro, números, acotados y textos; niveles de análisis editables en el catálogo), hecho; (3) evaluación automática (pasa o no pasa por parámetro) y condición del aceite y de aditivos, hecho: da las mismas condiciones que el FOLAB-26-092 en sus seis muestras; (4) informe por equipo, hecho: informe con sus muestras, tabla de tendencias, condición general, observaciones, quién elaboró y quién validó, copia fija al validar y gráficas de tendencia por parámetro; (5) PDF del informe con el formato "Análisis de tendencias en aceites" de MOT (datos, tabla de tendencias, gráficas, observaciones, quién elaboró y validó), hecho; (6) cierre, hecho: comparación con el FOLAB-26-092 (mismos valores y misma condición del aceite en sus seis muestras; las diferencias de desviación quedaron como pregunta P17), alerta de cambio de filtro cuando un informe validado lo recomienda, y aviso de muestras en la oportunidad. Decisiones D35 a D41; preguntas nuevas P17 a P19.
- **Etapa 5. Facturación y cobranza: terminada salvo el timbrado con PAC**, que queda para cuando MOT tenga su información (P8); mientras, la factura se registra a mano. Pendiente de revisión con administración. Plan de 7 pasos: (1) condiciones de crédito por razón social, hecho; (2) rentas mensuales como cargos, hecho: pantalla "Rentas del mes" que muestra lo que toca y genera los cargos que falten; (3) facturas en borrador a partir de cargos, hecho: se eligen los cargos, se corrigen encabezado y conceptos, y la ficha dice qué falta para timbrar; (4) registro manual de la factura emitida, hecho: folio, folio fiscal, fecha y tipo de cambio; XML (que el sistema lee y comprueba) y PDF; cancelación con motivo que libera los cargos; listo para cambiarse por el timbrado con PAC; (5) pagos y su aplicación a facturas, hecho: pago aplicado a una o varias facturas, parcial o completo, con resto por aplicar; saldo y estado de cobro en cada factura; complemento de pago registrado a mano; (6) anticipos, hecho: los pagos únicos del contrato (anticipo, instalación) se vuelven cargos desde su ficha; el anticipo se factura aparte y, ya pagado, se aplica a otras facturas sin pasarse de lo disponible; (7) cobranza y cierre, hecho: pantalla "Cuentas por cobrar" con antigüedad de saldos por razón social, saldo de cada orden de compra en el contrato y seguimiento de portales de proveedores por factura. Decisiones D42 a D48.
- Pipeline (D49): el tablero muestra todas las etapas hasta Ganada y Perdida (las cerradas, 90 días: `DIAS_CERRADAS_EN_TABLERO`) y se filtra por tipo: cliente nuevo, ampliación (up sell) y venta cruzada (cross sell).
- Decisiones de la Etapa 1 en DISENO §7: D9 (vendedor externo = canal, no usuario), D10 (cotizaciones de partidas libres), D11 (ganar solo marca pendiente de contrato), D12 a D17 (precios más IVA, folio CMOT, estados, comodato, renta a 3 años, contenedor, motivos de pérdida).
- **Mejoras de interfaz (noviembre de 2026), en curso.** Plan de 4 pasos: (1) Inicio como tablero y colores de estado, hecho; (2) ruta de navegación en las fichas, botones secundarios con borde visible y menú lateral compacto con el usuario siempre a la vista, hecho; (3) listas como tabla con buscador en escritorio (facturas, órdenes, cargos, muestras y clientes) y arrastrar y soltar en el tablero de oportunidades, hecho; (4) etiqueta y filtro de prospecto o cliente en Clientes (se deduce de si tiene contrato).
- Pendiente fuera de etapa: pantalla de bitácora; recuperación de contraseña por correo.
- Preguntas abiertas: DISENO §6.
