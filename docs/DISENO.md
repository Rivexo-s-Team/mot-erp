# Sistema MOT: documento de diseño

**Cliente:** Molecular Oil Technology, S.A.P.I. de C.V. (MOT)
**Desarrolla:** Rivexo, S.A. de C.V.
**Versión:** 0.1, 9 de noviembre de 2026
**Estado:** borrador para arrancar el desarrollo. Se corrige sobre la marcha.

Fuentes: plantilla de campos del director comercial (`BASE_DE_DATOS_MOT_09Nov26.xlsx`, hojas "BASE DE DATOS" y "Respuestas"), presentación comercial 2026, formato de servicio RecondOil Box (ejemplo Rassini, 2 nov 2026), informe de laboratorio FOLAB-26-092 (Rassini BYPASA, equipo 11B113), guía de interpretación de informes y respuestas del área técnica por WhatsApp. Las copias están en `docs/referencias/`.

---

## 1. El negocio en una página

MOT es el único distribuidor autorizado en México del **SKF RecondOil Box** (le dicen "Robox" o "riñón de filtrado"). Este equipo limpia aceite industrial (hidráulico o de transmisión) en la planta del cliente mediante doble separación, con filtros SKF. La propuesta de valor es que el cliente **no cambie el aceite**: MOT se lo deja igual o más limpio que nuevo.

MOT vende tres cosas:

| Modelo | Qué es | Cómo se cobra | Equipo |
|---|---|---|---|
| **Renta (comodato)** | Robox en consignación, normalmente por 3 años. Puede estar dedicado a un tanque o rotar entre varios ("carrusel"). | Mensualidad fija con anticipo. Con o sin filtros incluidos. Incluye estudios de laboratorio. | Se queda en el cliente |
| **Por evento** | MOT lleva el Robox, filtra un tanque y lo retira. Se propone repetir cada semestre o según el desgaste. | **Por litro del volumen del tanque**, facturado por evento. | Se retira |
| **Único / Servicio / Laboratorio** | Único: cualquier servicio de una sola vez. Servicio: cualquier trabajo distinto a la limpieza. Laboratorio: solo análisis de aceite. | Por evento o servicio. | — |

Además, el formato de servicio muestra **"Prueba tecnológica"** como modalidad. Se trata como un tipo de contrato más (pregunta abierta P2).

**Reglas comerciales confirmadas**
- El precio por litro es el **70 % del precio del aceite nuevo**, con un piso de **2.5 USD/L**. El precio del aceite nuevo sale de un comprobante del cliente o de una búsqueda en internet (se toma el valor más bajo razonable).
- **Hoy todos los contratos están en USD.** Si el cliente paga en pesos, él fija el tipo de cambio.
- El **mantenimiento siempre lo paga MOT**, salvo daño por mal uso del cliente.
- La planta de Querétaro está clausurada: **todo el servicio es en sitio**.

**Escala actual:** 4 clientes con renta fija y 2 vendedores (el director comercial en CDMX y un vendedor externo en Querétaro). Hay laboratorio propio, área técnica con especialistas de campo y facturación manual en el portal del SAT. No hay sistema previo: **no se migra un histórico**, se ordena la operación desde cero.

---

## 2. Objetivos y alcance

1. **Comercial:** pipeline de prospectos de principio a fin, con la muestra de aceite y los resultados de laboratorio como parte de la venta.
2. **Clientes:** expediente completo del grupo, sus plantas, razones sociales, contactos por área y equipos (tanques y máquinas).
3. **Flota y contratos:** cada Robox con su serie, dónde está, a qué contrato pertenece, en qué tanque trabaja y su historial.
4. **Operación:** el formato de servicio en papel pasa a ser una orden de servicio capturada desde el celular, con lecturas del Robox, partes, muestras, evidencias y firma del cliente.
5. **Laboratorio:** registro de muestras, captura de resultados, evaluación automática contra límites e informe de tendencias por equipo.
6. **Finanzas:** facturación CFDI 4.0 desde el sistema (en USD), cuentas por cobrar por razón social, seguimiento de portales de proveedores y anticipos.
7. **Después:** automatizar emisión y envío, cobranza, portal de clientes, comisiones, tablero de dirección y telemetría del Robox.

**Principio rector:** primero digitalizar, luego automatizar. Cada módulo tiene que poder usarse en papel-cero antes de agregarle automatismos.

**Fuera de alcance por ahora:** contabilidad, nómina, compras formales a SKF (solo se registran entradas de inventario) y el proceso de recolección de aceite en planta.

---

## 3. Arquitectura

- **Un solo cliente, un solo despliegue.** No hay multi-tenancy. El acceso se controla por **rol** y, en el portal, por **cuenta del cliente**.
- **Frontend y backend:** Next.js (App Router) con TypeScript, Server Components y Server Actions, Tailwind y shadcn/ui.
- **Datos:** Supabase con Postgres, Auth, Storage, Edge Functions y Cron (`pg_cron`).
- **Ambientes:** dos proyectos de Supabase, `mot-dev` (desarrollo; el único que tocan las sesiones de Claude) y `mot-prod` (MOT). El esquema solo cambia mediante migraciones versionadas en `supabase/migrations`.
- **Móvil:** la captura de campo es una sección del mismo sistema (`/campo`), diseñada para el celular primero y con guardado local del borrador, porque la señal en planta no está garantizada. El modo offline completo queda como mejora si hace falta.
- **PDFs:** orden de servicio firmada e informe de laboratorio, generados del lado del servidor.
- **Facturación:** CFDI 4.0 mediante un PAC con API. El proveedor está por elegir (decisión D3).
- **Archivos (Storage):** buckets privados `evidencias`, `informes-lab`, `contratos`, `cfdi`, `documentos-acceso`.

---

## 4. Modelo de datos

Los nombres de tablas y columnas van en español, en snake_case y sin acentos. Las tablas listadas abajo son la intención: el detalle de columnas se fija en cada migración.

### 4.1 Clientes

```
cuentas                 Grupo o empresa cliente (ej. "Rassini", "Orbia"). Existe desde que es prospecto.
  └─ plantas            "División": planta o ubicación operativa con su dirección (ej. "BYPASA", San Juan del Río).
       └─ equipos_cliente   Máquina o tanque cuyo aceite se limpia (ej. 11B116 "REP4", prensa vulcanizadora, 280 L).
razones_sociales        RFC, nombre, régimen, CP fiscal, uso de CFDI y si usa portal de proveedores. Pertenece a una cuenta.
contactos               Por cuenta o planta, con área: compras, mantenimiento, operaciones, gerente de planta,
                        cuentas por pagar, administración, finanzas. Marcas: recibe_facturas, recibe_informes.
requisitos_planta       Lo que la planta exige para entrar: REPSE, EPP, alta de proveedor, cursos…
```

- Cada **planta** se factura a **una razón social** por defecto (en los casos reales, Nacobre y Orbia, cada planta tiene la suya).
- `equipos_cliente` guarda: identificador del cliente, alias, aplicación, marca, aceite (catálogo), volumen del reservorio en litros, número y volumen de contenedores, tipo de conexión, altura, localización, temperatura de operación, frecuencia de cambio de aceite actual, costo del aceite virgen y quién toma las muestras (MOT o el cliente).
- `aceites` es un catálogo: marca, nombre comercial, grado ISO VG y viscosidad nominal a 40 °C. Es la base de los límites de laboratorio.

### 4.2 Comercial

```
oportunidades           Una venta posible: cuenta, planta, vendedor, tipo (nuevo | ampliación), origen
                        (referencia, recomendación, cliente anterior, prospección), etapa, volumen estimado, motivo de pérdida.
actividades             Llamadas, correos, presentaciones (email | presencial), visitas, seguimientos. Con fecha y responsable.
cotizaciones            Versionadas, ligadas a la oportunidad. Moneda USD.
  └─ cotizacion_lineas  Concepto, equipo del cliente, litros, precio unitario, unidad (litro | mes | evento | servicio).
```

**Etapas del pipeline** (confirmadas por el director comercial): primer contacto → presentación → visita → muestra → resultados de laboratorio → cotización → seguimiento → **ganada / perdida**.

**Cotizador por litro:** guarda el precio de referencia del aceite nuevo, su fuente (comprobante del cliente o internet, con archivo o URL) y la fecha. Calcula `max(0.70 × precio_referencia, 2.50 USD)`. El porcentaje y el piso son parámetros configurables, no constantes en el código.

**Una oportunidad ganada no se recaptura:** la cuenta, la planta y los equipos ya existen. Ganar abre la creación del contrato con los datos de la cotización.

### 4.3 Flota y contratos

```
robox                   Equipo MOT: número de serie (ej. 545592), modelo, versión de programa, SIM,
                        estado (disponible | en_cliente | en_taller | baja), fecha de alta.
contratos               Planta, razón social a facturar, tipo (renta | por_evento | unico | servicio | laboratorio |
                        prueba_tecnologica), nuevo o ampliación (contrato_origen_id), vigencia (inicio, término,
                        renovación), anticipo, incluye_filtros, incluye_laboratorio, frecuencia de visitas, estado.
  └─ contrato_tarifas   Concepto, unidad (mes | litro | evento | servicio), precio, equipo del cliente (opcional).
  └─ ordenes_compra     Número de OC del cliente, general o por equipo, monto, vigencia y saldo.
asignaciones_robox      Qué Robox está en qué contrato y planta, y entre qué fechas.
  └─ carrusel_equipos   Tanques del cliente que atiende un Robox en rotación, con su orden.
movimientos_robox       Cada rotación de un tanque a otro: fecha, origen, destino, quién lo movió (MOT | cliente).
```

- La **ubicación actual** de un Robox se calcula a partir de su asignación activa y su último movimiento. No se captura dos veces.
- **ID de caso:** en papel aparece como `RAS1-08` y se usa en el formato de servicio, en el frasco de la muestra y en el informe. Parece ser *cliente + número de Robox o caso + consecutivo*. Mientras se confirma la regla (P1), se guarda como texto con un formato sugerido y es único por equipo del cliente.

### 4.4 Operación

```
ordenes_servicio        Folio (hoy: AAMMDD + iniciales del técnico, ej. "261102 DV"), tipo (visita | taller),
                        planta, contrato, equipo del cliente, Robox, técnico responsable y acompañante,
                        fecha programada y fecha real, estado (programada | en_curso | cerrada | cancelada).
  ├─ os_actividades     Del catálogo (ver abajo). Varias por orden.
  ├─ os_fallas          Del catálogo de fallas.
  ├─ os_partes          Partes cambiadas o accesorios instalados → descuentan inventario.
  ├─ os_lecturas        Lecturas del Robox, "inicial" y "posterior": modelo, serie, programa, presión/filtro,
  │                     filter used (días), filter lifetime (días), runtime (días), ack. flow (L acumulados),
  │                     presión (bar), flujo (L/min), temperatura (°C). También la temperatura del aceite y
  │                     el volumen del reservorio.
  ├─ os_evidencias      Fotos (pantalla del Robox, termómetro, frascos, instalación).
  └─ os_firmas          Técnico MOT y responsable del cliente: nombre, cargo, fecha, firma dibujada.
visitas_programadas     Calendario: recurrentes por contrato o a solicitud del cliente.
partes                  Catálogo: filtro SKF500/HY (Core), filtro SKF500/DST, filtro sinterizado, imán de neodimio,
                        post-filtro, pre-filtro, o-rings, válvula de alivio, bomba S/M/L, motor, manómetro, HMI,
                        cables, fuente de poder, kits de conexión rápida, sensores…
inventario_movimientos  Entradas (compra a SKF), salidas (orden de servicio), ajustes. Existencia = suma de movimientos.
filtros_instalados      Qué filtro tiene cada Robox, desde cuándo y cuándo se cambió.
documentos_acceso       Documentos de MOT y de su personal (REPSE, DC-3, IMSS, EPP) con fecha de vencimiento.
```

**Catálogo de actividades** (tomado del formato en papel): presentación, levantamiento, entrega, instalación, puesta en marcha, capacitación, toma de muestras, cambio de filtros, rotación o movilización, limpieza, mantenimiento, adecuación, reemplazo y retiro.

**Catálogo de fallas:** Robox no enciende, loop de arranque, pantalla no responde, alarma activa, falla de bomba, medidor de flujo no gira, fuga de aceite, presión alta o flujo bajo, presión baja o flujo alto, presión o flujo irregular, obstrucción, desempeño, componente descompuesto, componente dañado por el cliente.

**Reglas de operación**
- En una orden **por evento**, al cerrarla se genera un **cargo facturable** = volumen del reservorio del tanque × tarifa por litro del contrato.
- Una falla marcada como "componente dañado por el cliente" permite generar un cargo al cliente. Fuera de ese caso, el mantenimiento es costo de MOT.
- Las partes usadas en la orden alimentan el **costo por contrato y por planta**.
- **Cambio de filtro:** hoy se hace a los 6 meses o antes si el laboratorio lo indica. El sistema alerta con base en `filter used` frente a `filter lifetime` y en el resultado del último informe.
- **Acceso a planta:** antes de cada visita se muestra la lista de requisitos de la planta y qué documentos de MOT o del técnico están por vencer.
- Al cerrar la orden se genera el PDF firmado, que se puede enviar al contacto de mantenimiento.

### 4.5 Laboratorio

```
muestras                ID de muestra (formato actual AAMMDD-NNN, ej. 260617-092), ID de caso, equipo del cliente,
                        orden de servicio u oportunidad de origen, tipo, tomada por (MOT | cliente),
                        fecha de muestreo y de recepción, nivel de análisis, estado.
parametros              Catálogo: nombre, unidad, grupo, método (norma), niveles que lo incluyen,
                        regla de límite y base de comparación.
resultados              Muestra × parámetro: valor numérico o cualitativo ("No detectado", "<300"),
                        resultado pasa | no pasa | n/a.
informes                Folio (formato actual "25-AT-380-RAS1-01"), equipo del cliente, muestras incluidas,
                        condición general, observaciones, quién lo elaboró y quién lo validó,
                        PDF, publicado al cliente (sí/no).
```

**Tipos de muestra:** virgen (línea base), usado (al arrancar la filtración), antes de filtrar y filtrado (tratado). La virgen y la usada se toman en la primera visita comercial o técnica. "Antes de filtrar" se toma al iniciar una limpieza, y "filtrado" al retirar el equipo o en las visitas periódicas.

**Niveles de análisis:** Básico, Básico + MPC, Extendido y Premium. El detalle de qué incluye cada uno está por confirmar con el laboratorio (P5).

**Parámetros** (del informe FOLAB-26-092):

| Grupo | Parámetros | Método | Límite (LMP) | Desviación contra |
|---|---|---|---|---|
| Fisicoquímicos | Código ISO 4/6/14 µm, partículas 4, 6 y 14 µm por 100 mL | ISO 4406:99 | 18/16/13 | usado vs tratado |
| | Sólidos suspendidos (ppm) | — | < 0.5 | usado vs tratado |
| | MPC ΔE | ASTM D7843 | < 15 | usado vs tratado |
| | Sólidos sedimentables (% m/v) | — | — | — |
| | Viscosidad a 40 °C (cSt) | ASTM D445 | nominal ± 10 % | usado vs tratado |
| | Agua disuelta y agua libre (ppm) | ASTM D6304 / E2412 | < 500 | valor teórico |
| | TAN (mg KOH/g), pH | ASTM D664 | virgen ± 0.20; pH > 5.5 (la guía dice > 5.0) | virgen vs tratado |
| | Oxidación (Abs/cm) | FTIR E2412 | virgen ± 0.20 | virgen vs tratado |
| Desgaste | Ag, Al, Cu, Fe, Ti, Cr, Pb, Sn, V (ppm) | XRF / ASTM D6481 | < 15 o < 50 según el elemento | usado vs tratado |
| Aditivos | Zn, S, Ca, P, Mg, Ba, Mo (ppm) | XRF | virgen ± 15 % | virgen vs tratado |
| Contaminantes | Si, Na, K (ppm) | XRF | — | usado vs tratado |
| Cualitativos | FTIR, colorimetría y escala de barnices MPC | — | — | — |

**Reglas de laboratorio**
- Cada parámetro guarda su **tipo de regla**: máximo fijo, código ISO, nominal ± %, línea base ± valor absoluto, línea base ± %, o sin límite. Los límites que dependen del aceite se toman del catálogo `aceites` o de la muestra virgen de ese equipo.
- **Condición del aceite**, según la guía: menos de 2 pruebas "no pasa" = **Normal**; de 2 a 3 = **Precaución**; más de 4 = **Crítico**. El caso de exactamente 4 no está definido (P6). Los umbrales son configurables.
- Hay una condición aparte para aditivos (Normal o Precaución).
- El informe muestra la **tendencia por equipo** a lo largo de todas sus muestras, con gráficas de partículas, agua, número ácido, desgaste, aditivos y contaminantes. Hoy esto se hace en Excel y el sistema lo genera solo.
- Ningún informe se publica al cliente sin la **validación** del responsable de laboratorio.
- Observación para el laboratorio: en el informe de ejemplo, el aceite es Mobil DTE 25 (ISO 46) pero el límite de viscosidad dice "68 ± 10 %". Tomar el límite del catálogo del aceite evita estas inconsistencias.

### 4.6 Finanzas

```
cargos                  Lo que se debe facturar: renta mensual, evento por litro, laboratorio, servicio,
                        partes por mal uso. Nacen del contrato, de una orden de servicio o se capturan a mano.
facturas                CFDI 4.0: razón social, moneda (USD), tipo de cambio, método (PUE | PPD), forma de pago,
                        uso de CFDI, OC del cliente (opcional), UUID, XML y PDF, estado.
  └─ factura_conceptos  Vienen de los cargos.
anticipos               Anticipos de renta y su aplicación a facturas (procedimiento del SAT para anticipos).
pagos                   Pago recibido, moneda, tipo de cambio, aplicación a facturas y complemento de pago (REP) cuando es PPD.
portal_proveedor        Por factura en clientes con portal: pendiente de subir → subida → aprobada →
                        programada → pagada, con fechas y notas.
condiciones_credito     Por razón social: días de crédito, requiere OC, usa portal, contacto de cuentas por pagar.
```

**Reglas de finanzas**
- **Cuentas por cobrar por razón social**, con antigüedad de saldos según los días de crédito.
- **Facturas en USD con tipo de cambio.** El criterio del tipo de cambio para el CFDI y para los pagos en pesos se valida con el contador de MOT (P8).
- **Primera etapa:** emitir desde el sistema (timbrado con PAC) y enviar manualmente. **Después:** emisión recurrente de rentas y envío automático. Para los clientes con portal importa **emitir**; el correo es secundario.
- Las **comisiones** de los vendedores quedan pendientes de definir con Fernando (P3).

### 4.7 Usuarios, roles y auditoría

```
perfiles                Usuario de Supabase Auth + nombre, puesto y rol.
roles / permisos        Matriz rol × permiso. Configurable, no fija en el código.
usuarios_portal         Usuarios del cliente, ligados a una cuenta. Solo ven lo suyo.
bitacora                Quién cambió qué y cuándo en tablas sensibles: precios, contratos, facturas, resultados.
```

**Roles tentativos** (el Director General de MOT confirmará usuarios y alcances, P4):

| Rol | Ve y hace |
|---|---|
| Dirección | Todo, incluidos precios, costos y márgenes. |
| Comercial | Pipeline, cuentas, contactos y cotizaciones. El vendedor externo ve solo sus oportunidades (por confirmar). |
| Técnico | Su agenda, órdenes de servicio, flota y equipos del cliente. Sin precios. |
| Laboratorio | Muestras, resultados e informes. Sin precios. |
| Administración | Contratos, facturación, cobranza, inventario. |
| Cliente (portal) | Sus informes publicados, sus órdenes de servicio y sus facturas. |

**Seguridad:** RLS activada en todas las tablas. Los precios y costos viven en tablas o columnas que solo leen Dirección, Comercial y Administración. El portal se diseña desde el inicio aunque se construya al final.

---

## 5. Etapas de desarrollo

Cada etapa termina cuando se cumplen sus criterios de aceptación y se revisa con MOT. El orden puede cambiar si MOT prioriza otra cosa.

### Etapa 0. Cimientos
- Repo, Next.js, Supabase dev, migraciones, tipos generados y despliegue de previsualización.
- Auth, perfiles, roles y permisos con RLS. Layout con navegación por rol.
- Catálogos base: aceites, partes, actividades, fallas, parámetros de laboratorio.
- Datos semilla con el caso real de Rassini (cuenta, planta BYPASA, equipos 11B113 y 11B116, Robox 545592).

**Criterios:** un usuario de cada rol entra y solo ve lo que le corresponde. `supabase db reset` reconstruye todo desde cero con los datos semilla.

### Etapa 1. Clientes y comercial
- Cuentas, plantas, razones sociales, contactos, equipos del cliente y requisitos de planta.
- Pipeline tipo kanban con etapas, actividades y vendedor.
- Cotizador por litro (70 % con piso) y cotizaciones de renta.
- Ganar una oportunidad abre la creación del contrato.

**Criterios:** el director comercial captura un prospecto real y lo lleva desde el primer contacto hasta una cotización en PDF. Los 4 clientes actuales quedan cargados.

### Etapa 2. Flota y contratos
- Inventario de Robox, contratos con tarifas y órdenes de compra, asignaciones, carrusel y movimientos.

**Criterios:** para cada Robox se ve dónde está, de qué contrato es y en qué tanque trabaja. Los contratos de los 4 clientes quedan capturados.

### Etapa 3. Operación en campo
- Orden de servicio móvil (la versión digital del formato en papel), con lecturas inicial y posterior, actividades, fallas, partes, fotos y firma.
- Agenda de visitas, inventario de filtros y partes, alertas de cambio de filtro y lista de acceso a planta.
- PDF de la orden firmada. En órdenes por evento, cargo automático por litros.

**Criterios:** un técnico llena una orden completa en el celular en una visita real, sin papel. La existencia de filtros se actualiza.

### Etapa 4. Laboratorio
- Registro de muestras (ligadas a la orden o a la oportunidad), captura de resultados, evaluación automática y condición del aceite.
- Informe de tendencias por equipo en pantalla y en PDF, con validación del responsable.

**Criterios:** el informe FOLAB-26-092 se reproduce en el sistema con los mismos valores y condición, y el laboratorio lo valida contra su Excel.

### Etapa 5. Facturación y cobranza
- Integración con el PAC: CFDI en USD, anticipos, pagos y complementos de pago.
- Cargos → facturas, cuentas por cobrar por razón social, seguimiento de portales.

**Criterios:** se timbra una factura real de renta en USD y se registra su pago con complemento. El reporte de antigüedad cuadra con lo que lleva administración.

### Etapa 6. Automatización y portal
- Emisión recurrente de rentas, envío automático de facturas e informes, recordatorios de cobranza (correo o WhatsApp con Twilio).
- Portal de clientes, tablero de dirección (ingresos, rentabilidad por planta, pipeline, cobranza) y comisiones.
- Evaluar telemetría del Robox: el equipo tiene SIM y señal, así que podría leerse en automático lo que hoy se copia a mano de la pantalla (P9).

---

## 6. Preguntas abiertas

Ninguna bloquea el arranque. Cada una se resuelve antes de la etapa indicada.

| # | Pregunta | Para | Antes de |
|---|---|---|---|
| P1 | Regla del **ID de caso** (`RAS1-08`): ¿qué significa cada parte? ¿Es por equipo, por Robox o por carrusel? ¿Y el folio del informe (`25-AT-380-RAS1-01`)? | Área técnica / Laboratorio | Etapa 2 |
| P2 | **Prueba tecnológica** y **Comodato** en el formato: ¿comodato es lo mismo que renta? ¿La prueba tecnológica es gratuita y tiene duración? | Dirección comercial | Etapa 2 |
| P3 | **Contratos y anticipos** (estructura real) y **esquema de comisiones**. | Fernando | Etapas 2 y 6 |
| P4 | **Usuarios y alcances**: nombre, puesto, rol. ¿El vendedor externo ve solo lo suyo? | Director General | Etapa 0 (al cierre) |
| P5 | ¿Qué incluye cada **nivel de análisis** (Básico, Básico + MPC, Extendido, Premium) y cuál se usa en cada caso? El frasco de ejemplo dice "Entrada": ¿qué tipos de muestra existen (entrada, salida, antes de filtrar…)? | Laboratorio | Etapa 4 |
| P6 | ¿Exactamente **4 pruebas "no pasa"** da Precaución o Crítico? ¿Qué parámetros cuentan para la condición? ¿El límite de pH es > 5.0 (guía) o > 5.5 (informe)? | Laboratorio | Etapa 4 |
| P7 | **Reverso del formato de servicio** ("Datos e información al reverso"): foto, por favor. | Área técnica | Etapa 3 |
| P8 | **PAC** a usar, **tipo de cambio** para CFDI en USD y para pagos en pesos, y manejo fiscal de anticipos. | Administración / contador | Etapa 5 |
| P9 | ¿MOT tiene acceso al portal de SKF donde reporta el Robox? ¿SKF ofrece API? | Área técnica | Etapa 6 |
| P10 | Inventarios: lista de Robox (serie, ubicación, estado) y existencias de filtros y partes. | Área técnica | Etapa 2 |
| P11 | ¿Hay señal en las plantas, o los técnicos necesitan capturar sin conexión? | Área técnica | Etapa 3 |

---

## 7. Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| D1 | Un solo cliente, sin multi-tenancy; acceso por rol y portal por cuenta. | Es un desarrollo a medida para MOT. |
| D2 | La negociación vive en el **contrato por planta**, no en la cuenta. | Cada planta tiene su propia razón social, precio y OC. |
| D3 | Facturación con PAC vía API (proveedor por elegir). | MOT quiere facturar desde el sistema y luego automatizar. |
| D4 | Moneda y tipo de cambio en todo importe, desde el día uno. | Todos los contratos actuales son en USD. |
| D5 | Las lecturas del Robox se capturan como datos estructurados, no como notas. | Permiten alertas de filtro, tendencias y una futura telemetría. |
| D6 | Los límites de laboratorio son datos configurables (catálogo de parámetros y de aceites). | El laboratorio ajusta criterios sin tocar el código. |
| D7 | Porcentaje (70 %) y piso (2.5 USD/L) del cotizador son parámetros. | Se pueden cambiar por política comercial. |
| D8 | Nombres de dominio (tablas y columnas) en español; el código de framework, en inglés. | Facilita que MOT y Rivexo lean la base de datos. |
