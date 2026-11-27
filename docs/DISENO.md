# Sistema MOT: documento de diseño

**Cliente:** Molecular Oil Technology, S.A.P.I. de C.V. (MOT)
**Desarrolla:** Rivexo, S.A. de C.V.
**Versión:** 0.2, 12 de noviembre de 2026
**Estado:** borrador para arrancar el desarrollo. Se corrige sobre la marcha.

Fuentes: plantilla de campos del director comercial (`BASE_DE_DATOS_MOT_09Nov26.xlsx`, hojas "BASE DE DATOS" y "Respuestas"), presentación comercial 2026, formato de servicio RecondOil Box (ejemplo Rassini, 2 nov 2026), informe de laboratorio FOLAB-26-092 (Rassini BYPASA, equipo 11B113), guía de interpretación de informes y respuestas del área técnica por WhatsApp. Además, las respuestas del director comercial del 12 nov 2026 (archivo `BASE_DE_DATOS_MOT_06Nov26.xlsx`, hojas "Respuestas2", "RENTAS" y "Cotizacion Tipo"; no está en el repositorio porque trae datos de contacto de clientes). Las copias están en `docs/referencias/`.

---

## 1. El negocio en una página

MOT es el único distribuidor autorizado en México del **SKF RecondOil Box** (le dicen "Robox" o "riñón de filtrado"). Este equipo limpia aceite industrial (hidráulico o de transmisión) en la planta del cliente mediante doble separación, con filtros SKF. La propuesta de valor es que el cliente **no cambie el aceite**: MOT se lo deja igual o más limpio que nuevo.

MOT vende tres cosas:

| Modelo | Qué es | Cómo se cobra | Equipo |
|---|---|---|---|
| **Renta (comodato)** | Robox en consignación, normalmente por 3 años. Puede estar dedicado a un tanque o rotar entre varios ("carrusel"). | Mensualidad fija con anticipo. Con o sin filtros incluidos. Incluye estudios de laboratorio. | Se queda en el cliente |
| **Por evento** | MOT lleva el Robox, filtra un tanque y lo retira. Se propone repetir cada semestre o según el desgaste. | **Por litro del volumen del tanque**, facturado por evento. | Se retira |
| **Único / Servicio / Laboratorio** | Único: cualquier servicio de una sola vez. Servicio: cualquier trabajo distinto a la limpieza. Laboratorio: solo análisis de aceite. | Por evento o servicio. | — |

El formato de servicio muestra también "Comodato" y "Prueba tecnológica". **Comodato** es la forma jurídica de la renta (el equipo queda al cuidado del cliente, no en propiedad). La **prueba tecnológica** ya no se hace y no es un tipo de contrato (D14).

**Reglas comerciales confirmadas**
- El precio por litro es el **70 % del precio del aceite nuevo**, con un piso de **2.5 USD/L**. El precio del aceite nuevo sale de un comprobante del cliente o de una búsqueda en internet (se toma el valor más bajo razonable).
- **Hoy todos los contratos están en USD.** Si el cliente paga en pesos, él fija el tipo de cambio.
- El **mantenimiento siempre lo paga MOT**, salvo daño por mal uso del cliente.
- La planta de Querétaro está clausurada: **todo el servicio es en sitio**.

**Escala actual:** 3 clientes con 13 rentas (GOPLAS, NACOBRE y TT Green Metals, por 4,871 USD al mes más IVA, según el archivo del 12 nov 2026; antes se hablaba de 4 clientes) y 2 vendedores (el director comercial en CDMX y un vendedor externo en Querétaro). Hay laboratorio propio, área técnica con especialistas de campo y facturación manual en el portal del SAT. No hay sistema previo: **no se migra un histórico**, se ordena la operación desde cero.

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
oportunidades           Una venta posible: cuenta, planta, responsable interno, canal (vendedor externo, opcional),
                        tipo (nuevo | ampliación), origen
                        (referencia, recomendación, cliente anterior, prospección), etapa, volumen estimado, motivo de pérdida.
actividades             Llamadas, correos, presentaciones (email | presencial), visitas, seguimientos. Con fecha y responsable.
cotizaciones            Versionadas, ligadas a la oportunidad. Moneda USD.
  └─ cotizacion_lineas  Concepto, equipo del cliente, litros, precio unitario, unidad (litro | mes | evento | servicio).
```

**Etapas del pipeline** (confirmadas por el director comercial): primer contacto → presentación → visita → muestra → resultados de laboratorio → cotización → seguimiento → **ganada / perdida / descartada** (D55). Tipos de oportunidad: cliente nuevo, ampliación (up sell) y venta cruzada (cross sell) (D49).

**Cotizador por litro:** guarda el precio de referencia del aceite nuevo, su fuente (comprobante del cliente o internet, con archivo o URL) y la fecha. Calcula `max(0.70 × precio_referencia, 2.50 USD)`. El porcentaje y el piso son parámetros configurables, no constantes en el código.

**Una oportunidad ganada no se recaptura:** la cuenta, la planta y los equipos ya existen. Ganar abre la creación del contrato con los datos de la cotización.

### 4.3 Flota y contratos

```
robox                   Equipo MOT: número de serie (ej. 545592), modelo, versión de programa, SIM,
                        estado (disponible | en_cliente | en_taller | baja), fecha de alta.
contratos               Planta, razón social a facturar, tipo (renta | por_evento | unico | servicio | laboratorio),
                        nuevo o ampliación (contrato_origen_id), vigencia (inicio, término,
                        renovación), anticipo, incluye_filtros, incluye_laboratorio, frecuencia de visitas, estado.
  └─ contrato_tarifas   Concepto, unidad (mes | litro | evento | servicio | unico), precio, equipo del cliente (opcional).
  └─ ordenes_compra     Número de OC del cliente, monto y vigencia. Cada tarifa apunta a la OC que la cubre
                        (sin tarifas ligadas = general). El saldo se calcula con las facturas (Etapa 5).
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
documentos_acceso       Documentos de MOT y de su personal (REPSE, EPP, IMSS opcional; lista editable) con fecha de vencimiento.
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
| Comercial | Pipeline, cuentas, contactos y cotizaciones. Los vendedores externos no son usuarios (ver D9). |
| Técnico | Su agenda, órdenes de servicio, flota y equipos del cliente. Sin precios. |
| Laboratorio | Muestras, resultados e informes. Sin precios. |
| Administración | Contratos, facturación, cobranza, inventario. |
| Coordinación | Agenda y órdenes de servicio: las crea, las asigna y las corrige. Consulta clientes, contratos, flota, inventario y laboratorio. Sin precios ni facturación (D58). |
| Administración y coordinación | La suma de los dos anteriores, para un usuario que comparten dos personas (D59). |
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

**Cierre (13 nov 2026):** las 13 rentas de la lista del director comercial quedaron en `mot-dev` como 5 contratos vigentes: GOPLAS Lechería (4 Robox, termina el 31/03/2027), GOPLAS Lechería (1 Robox, termina el 30/09/2028), NACOBRE Celaya (2), NACOBRE SLP (5) y TT Green Metals Guanajuato (1); en total 4,871 USD al mes más IVA, cada tarifa con su orden de compra. Quedó pendiente con MOT: (a) los números de serie de los Robox y en qué tanque está cada uno (P10), para darlos de alta y asignarlos; (b) las fechas de inicio, que se estimaron como término menos 3 años; (c) si cada renta incluye filtros y laboratorio; (d) si el segundo contrato de GOPLAS es ampliación del primero; (e) si "CMOT 2025/001" es la orden de compra de TT Green Metals; (f) el contrato de Rassini, que no viene en la lista.

### Etapa 3. Operación en campo
- Orden de servicio móvil (la versión digital del formato en papel), con lecturas inicial y posterior, actividades, fallas, partes, fotos y firma.
- Agenda de visitas, inventario de filtros y partes, alertas de cambio de filtro y lista de acceso a planta.
- PDF de la orden firmada. En órdenes por evento, cargo automático por litros.

**Criterios:** un técnico llena una orden completa en el celular en una visita real, sin papel. La existencia de filtros se actualiza.

**Cierre (16 nov 2026):** quedó construido todo lo de la etapa: órdenes de servicio con folio automático, captura en el celular que funciona sin señal, fotos, firmas dibujadas, cierre, PDF con el formato "Servicio RecondOil Box", inventario con salida automática de las partes usadas, filtros por Robox con alerta de cambio, agenda con visitas recurrentes, documentos de acceso con la revisión antes de cada visita, y cargos por facturar. Falta para dar por cumplido el criterio: (a) que un técnico de MOT llene una orden en una visita real; (b) que MOT capture los Robox, los usuarios, el inventario inicial y los documentos de acceso; (c) las respuestas a P12 a P16 sobre el manual de procesos; (d) el reverso del formato en papel (P7); (e) el envío del PDF por correo y los costos de las partes, que quedaron fuera.

### Etapa 4. Laboratorio
- Registro de muestras (ligadas a la orden o a la oportunidad), captura de resultados, evaluación automática y condición del aceite.
- Informe de tendencias por equipo en pantalla y en PDF, con validación del responsable.

**Criterios:** el informe FOLAB-26-092 se reproduce en el sistema con los mismos valores y condición, y el laboratorio lo valida contra su Excel.

**Cierre (17 nov 2026):** quedó construido todo lo de la etapa: muestras con ID automático, captura de resultados, evaluación pasa / no pasa, condición del aceite y de aditivos, informe por equipo con tabla y gráficas de tendencia, validación que fija el contenido, PDF, alerta de cambio de filtro por recomendación del laboratorio y avisos de muestra en el pipeline. **Comparación con el FOLAB-26-092** (equipo 11B113 de Rassini, seis muestras, cargadas como datos de prueba locales): los valores son los mismos; la condición del aceite coincide en las seis muestras; la de aditivos, en cuatro de cinco (en la muestra sin resultados de aditivos el sistema dice "sin datos" y el informe "Normal"); la desviación coincide en partículas, sólidos suspendidos, viscosidad y metales de desgaste, y difiere en aditivos, oxidación, código de limpieza y MPC (P17). El límite de viscosidad sale del aceite real (46 ± 10 %), no el "68 ± 10 %" del informe. Falta que el laboratorio lo valide contra su Excel y responda P5, P6 y P17 a P19; el caso de Rassini no está en `mot-dev` porque Rassini no es uno de los tres clientes cargados ahí.

### Etapa 5. Facturación y cobranza
- Integración con el PAC: CFDI en USD, anticipos, pagos y complementos de pago.
- Cargos → facturas, cuentas por cobrar por razón social, seguimiento de portales.

**Criterios:** se timbra una factura real de renta en USD y se registra su pago con complemento. El reporte de antigüedad cuadra con lo que lleva administración.

**Cierre (19 nov 2026):** quedó construido todo lo de la etapa menos el timbrado: condiciones de crédito por razón social, rentas mensuales como cargos, facturas a partir de cargos, registro manual de la factura emitida con su XML y PDF, cancelación, pagos aplicados a facturas con complemento registrado a mano, pagos únicos y anticipos, cuentas por cobrar con antigüedad de saldos, saldo de las órdenes de compra y seguimiento de portales de proveedores (D42 a D48). **Falta:** el timbrado con PAC (P8), que sustituye el registro manual de la factura, del complemento de pago y del CFDI de egreso; por eso el primer criterio ("se timbra una factura real") sigue abierto. El segundo (que la antigüedad cuadre con lo que lleva administración) se comprueba cuando MOT capture sus facturas vigentes.

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
| P2 | ~~Prueba tecnológica y Comodato~~ **Resuelta el 12 nov 2026** (ver D14). | Dirección comercial | — |
| P3 | **Esquema de comisiones** del vendedor externo: comisiona sobre ventas, pero Dirección General aún define los montos. (La estructura de la renta quedó en D15.) | Dirección General | Etapa 6 |
| P4 | **Usuarios y alcances**: nombre, puesto, rol. (Lo del vendedor externo quedó resuelto en D9.) | Director General | Etapa 0 (al cierre) |
| P5 | ¿Qué incluye cada **nivel de análisis** (Básico, Básico + MPC, Extendido, Premium) y cuál se usa en cada caso? El frasco de ejemplo dice "Entrada": ¿qué tipos de muestra existen (entrada, salida, antes de filtrar…)? | Laboratorio | Etapa 4 |
| P6 | ¿Exactamente **4 pruebas "no pasa"** da Precaución o Crítico? ¿Qué parámetros cuentan para la condición? ¿El límite de pH es > 5.0 (guía) o > 5.5 (informe)? | Laboratorio | Etapa 4 |
| P7 | **Reverso del formato de servicio:** el frente dice "Datos e información al reverso", pero no tenemos esa cara. Por ahora se construye con el frente; al revisar con el área técnica se pregunta si falta algún dato. | Área técnica | Etapa 3 (al cierre) |
| P8 | **PAC** a usar, **tipo de cambio** para CFDI en USD y para pagos en pesos, y manejo fiscal de anticipos. | Administración / contador | Etapa 5 |
| P9 | ¿MOT tiene acceso al portal de SKF donde reporta el Robox? ¿SKF ofrece API? | Área técnica | Etapa 6 |
| P10 | Inventarios: lista de Robox (serie, ubicación, estado) y existencias de filtros y partes. | Área técnica | Etapa 2 |
| P11 | ~~Señal en las plantas~~ **Resuelta el 13 nov 2026** (ver D25). | Área técnica | — |
| P12 | El manual de procesos nombra a un **Gerente de Operaciones** que autoriza (movimientos de máquinas, liberación tras mantenimiento, retiros) y a **Instaladores** que ejecutan. ¿Se crea ese rol y se piden esas autorizaciones en el sistema, o basta con Dirección y Técnico? | Director General | Cierre de Etapa 3 |
| P13 | ¿Cada Robox llevará un **identificador propio de MOT** (el manual propone `MOL-001`) además del número de serie? | Operaciones | Cierre de Etapa 3 |
| P14 | **Estados de la máquina** del manual (Operando, Mantenimiento, Reparación, Disponible, Retirado) frente a los del sistema (Disponible, En cliente, En taller, Baja), y registro de **horas acumuladas** (horómetro). ¿Se adoptan? | Operaciones | Cierre de Etapa 3 |
| P15 | **Instalación y retiro:** el manual propone formatos propios (evaluación del sitio, checklist de traslado, protocolo de pruebas, acta de aceptación, inspección de salida, acta de retiro). Hoy son una orden de servicio con la actividad "Instalación" o "Retiro". ¿Se necesitan esos checklists y actas? | Operaciones | Cierre de Etapa 3 |
| P16 | **Mantenimiento:** el manual pide en la orden de trabajo prioridad, tiempos de paro y una liberación autorizada del equipo. ¿Se agregan a la orden de servicio? | Operaciones | Cierre de Etapa 3 |
| P17 | **Desviación del informe:** la nota del informe dice que en aditivos, TAN y oxidación la desviación es contra el aceite virgen, pero los números del FOLAB-26-092 salen contra el aceite usado (y la oxidación como diferencia, no como porcentaje). ¿Cuál es la regla? Además: cuando el valor de referencia es 0 el Excel pone 100 %, en el código de limpieza pone "-1/0/0" y en MPC pone "Pasa"; el sistema deja esas tres vacías o en porcentaje. | Laboratorio | Cierre de Etapa 4 |
| P18 | En la **muestra virgen** del equipo 11B113 (251106-329) el zinc es 19.9 ppm y el azufre 6943 ppm; en todas las demás son cerca de 500 y 670. ¿Son correctos? Por esos valores los aditivos salen siempre en Precaución. ¿Con cuántos aditivos fuera de rango la condición de aditivos es Precaución? | Laboratorio | Cierre de Etapa 4 |
| P19 | El informe actual trae hojas de **FTIR y colorimetría** con imágenes. ¿Se guardan en el sistema y salen en el PDF? ¿Y la información del Robox en cada muestra (totalizador de flujo, litros filtrados, días de tratamiento)? | Laboratorio | Cierre de Etapa 4 |
| P20 | **Usuarios que faltan:** correo y alcance de Claudia (administración), Erika (agenda y órdenes) y Edgar (vendedor). El rol de Erika ya existe: Coordinación (D58). ¿Claudia ve precios y márgenes? | Fernando | Antes de capacitar |
| P21 | **Visitas recurrentes:** ¿qué las detona y cada cuánto, y cambia entre renta y por litro? Quedó como tarea del grupo. | Fernando, Daniel, Juan Pablo | Antes de automatizar la agenda |
| P22 | **Robox comodín:** ¿basta marcar una unidad como respaldo y registrar la sustitución como un movimiento, o se necesita un flujo propio (qué pasa con el contrato y la renta mientras tanto)? | Fernando, Daniel | Antes de construirlo |
| P23 | **Cambio de filtro:** hoy la alerta salta a los 6 meses; Daniel dice que duran cerca de un año y que el criterio real es comparar análisis consecutivos. ¿Se sube el plazo a 12 meses? ¿Se quiere un aviso automático cuando el aceite deja de mejorar entre dos muestras? | Daniel, Evelyn | Antes de usar la alerta en serio |
| P24 | **Proceso comercial (MOT-P06, propuesta del consultor):** ¿se adopta? Cambiaría las etapas del pipeline (prospección, calificación, reunión, diagnóstico, piloto, propuesta, negociación, cierre, transferencia) y pide en cada oportunidad importe estimado, probabilidad, fecha estimada de cierre, prioridad A/B/C con su matriz de calificación, impedimento y bitácora de contactos. El propio documento pide que los dueños confirmen antes estructura, CRM, autorizaciones, margen mínimo y metas. | Dirección General | Cuando se valide |

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
| D9 | Los **vendedores externos no son usuarios ni un rol**: son un canal de venta que solo comisiona. La oportunidad guarda el canal y un responsable interno que le da seguimiento. | Definido por Rivexo el 10 nov 2026. Evita dar acceso al sistema a terceros. |
| D10 | Las **cotizaciones son de partidas libres**: el vendedor captura las partidas (pueden ser recurrentes). El cotizador por litro (70 % con piso) es una ayuda para la partida más común, no una regla obligatoria. La cotización guarda el valor total del contrato si es renta, o los litros estimados si es por litro. | Definido por Rivexo el 10 nov 2026. MOT decide cada cotización. |
| D11 | En la Etapa 1, **ganar una oportunidad** solo la marca como pendiente de contrato; el contrato se crea en la Etapa 2. Las etapas "muestra" y "resultados de laboratorio" son solo etapas del tablero, con notas y un archivo adjunto opcional, hasta la Etapa 4. | Los módulos de contratos y laboratorio son de etapas posteriores. |
| D12 | Los **precios se cotizan más IVA**: la cotización muestra subtotal y total sin IVA, con la nota "Precios más IVA". El 70 % y el piso de 2.50 USD/L son sin IVA. | Respuesta del director comercial y su cotización tipo (12 nov 2026). |
| D13 | La cotización lleva **folio anual** `CMOT AAAA-NNN` (las versiones de una misma cotización lo comparten), vigencia de **15 días** por defecto (parámetro), y estados **borrador → enviada → aceptada o rechazada**. El PDF sigue la cotización tipo de MOT. | Respuesta del director comercial (12 nov 2026). |
| D14 | **Comodato** es la forma jurídica de la renta, no otro tipo de contrato. La **prueba tecnológica** (y el "pay for success") ya no se hace: no existe como tipo de contrato. | Respuesta del director comercial (12 nov 2026). Cierra P2. |
| D15 | **Renta:** contrato a 3 años, con o sin filtros según la negociación (MOT prefiere que el filtro lo pague el cliente), con 2 meses de anticipo más el costo de instalación. | Respuesta del director comercial (12 nov 2026). Base para los contratos de la Etapa 2. |
| D16 | El **precio de referencia** del aceite nuevo se puede capturar como costo de un contenedor y sus litros (ej. 2,900 USD ÷ 200 L = 14.50 USD/L). | Así lo calcula MOT en su cotización tipo. |
| D17 | Los **motivos de pérdida** son un catálogo (7 iniciales del director comercial), con detalle libre opcional. | Para poder contar por qué se pierden las ventas. |
| D18 | Un **contrato** es por planta y por negociación, con una línea por cada Robox rentado (precio mensual y orden de compra). | Así vienen las 13 rentas actuales: varias máquinas por planta, cada una con su precio y su OC. |
| D19 | La **flota** la editan Dirección y Técnico; los **contratos**, Dirección y Administración (Comercial solo consulta). Tentativo hasta cerrar P4. | El técnico es quien conoce los equipos; el contrato es un documento administrativo. |
| D20 | El **anticipo y la instalación** de un contrato se capturan como tarifas de "pago único", junto a las tarifas por mes, litro, evento o servicio. Los estados del contrato son borrador, vigente, terminado y cancelado. Tentativo. | Es lo más sencillo y deja todos los precios del contrato en un solo lugar, con la misma protección y bitácora. |
| D21 | Un contrato se puede **crear desde una oportunidad ganada**: queda ligado a ella y copia como tarifas las partidas de la cotización aceptada. Solo lo hace quien edita contratos y además ve el pipeline (hoy, Dirección); Administración los captura directo en Contratos. | Para no recapturar (§4.2) sin abrir el pipeline a más roles antes de cerrar P4. |
| D22 | Una **orden de compra** pertenece a un contrato y cada tarifa indica qué orden la cubre; una orden sin tarifas ligadas es general. Lleva importes, así que la ven solo quienes ven precios. El **saldo** se calculará cuando existan las facturas (Etapa 5). | En las rentas actuales hay órdenes por Robox y órdenes que cubren dos Robox. |
| D23 | La **asignación** de un Robox a un contrato, su carrusel y sus movimientos los captura quien edita la flota (Dirección y Técnico; tentativo hasta P4). Un Robox solo puede estar en un contrato a la vez; al asignarlo queda "en cliente" y al terminar la asignación vuelve a "disponible". El tanque actual es el destino del último movimiento (o el único tanque del carrusel). El **ID de caso** se guarda como texto libre en cada tanque del carrusel, mientras se confirma P1. | Así la ubicación no se captura dos veces (§4.3) y el estado del Robox no se contradice con su asignación. |
| D24 | **Orden de servicio:** el folio se genera solo con la fecha programada y las iniciales del técnico responsable (`261102 DV`); si ese técnico ya tiene una orden ese día, lleva consecutivo (`261102 DV 2`). Todos los internos consultan; Técnico y Dirección crean y llenan; el técnico solo edita las órdenes donde va como responsable o acompañante; Dirección, todas. Una orden cerrada ya no cambia. Accesos tentativos hasta P4 (serán entre 5 y 7 usuarios internos). | Es el folio que MOT ya usa. Confirmado por Rivexo el 13 nov 2026. |
| D25 | **Captura sin señal:** hay plantas con buena señal y plantas remotas sin ella. La orden se abre con señal; lo capturado se guarda en el teléfono y se envía al sistema en cuanto vuelve la señal. Cierra P11. | Respuesta de Rivexo (13 nov 2026). Es lo más sencillo que cubre las plantas remotas. |
| D26 | **Documentos de acceso a planta:** REPSE y equipo de protección (EPP) son los que el director comercial confirmó; el IMSS del personal es opcional. El DC-3 no está confirmado por MOT: los tipos de documento serán una lista editable, para agregarlo si lo piden. El **inventario** inicial de filtros y partes lo captura MOT en el sistema. Los **cargos** de una orden quedan como pendientes de facturar hasta la Etapa 5. | Para no pedir documentos que nadie exige y no frenar la etapa por datos que MOT puede cargar después. |
| D27 | **Captura de la visita:** todos los datos son opcionales (cada visita llena lo que aplica). El sistema propone lo que ya sabe (modelo, serie y programa del Robox, volumen del reservorio, ID de caso del carrusel) y el técnico lo corrige. Solo "Toma de muestras" y "Cambio de filtros" piden cantidad, como en el formato; se configura en el catálogo de actividades. Si en el teléfono hay cambios sin enviar, mandan sobre lo guardado en el sistema. "Presión / Filtro" se guarda como texto libre. | Es como se llena hoy el papel, y evita que el técnico pierda lo capturado sin señal. |
| D28 | **Cierre de la orden:** solo se cierra una orden en curso y firmada: siempre por el técnico y, si es una visita, también por el responsable del cliente (una orden de taller no lleva firma del cliente). Cerrada, ya no cambia nada: ni captura, ni fotos, ni firmas. Las firmas se dibujan en el celular y funcionan sin señal; las fotos necesitan señal para subirse y son opcionales. Quitar una foto solo la oculta. | El formato en papel lleva las dos firmas. Las fotos pesan demasiado para guardarlas en el borrador del teléfono. |
| D29 | **PDF de la orden:** reproduce el frente del formato "Servicio RecondOil Box" en una hoja carta: datos del cliente y del equipo, todas las actividades y fallas del catálogo con las marcadas resaltadas, lecturas inicial y posterior, notas de la visita y las dos firmas. No incluye las notas internas con las que se programó la orden, ni partes y accesorios (llegan con el inventario), ni las fotos. Si la orden no está cerrada, el documento lo advierte. Por ahora se descarga y se comparte a mano; el envío por correo queda pendiente. | Es el documento que hoy recibe el cliente en papel. El envío por correo requiere configurar un servicio de correo, igual que la recuperación de contraseña. |
| D30 | **Inventario:** la existencia de cada parte es la suma de sus movimientos (entradas, salidas y ajustes por conteo), que no se editan ni se borran. Las partes y accesorios usados en una orden se capturan en la visita y salen del inventario al cerrar la orden. Si no había existencia registrada, queda en negativo y se resalta; no se bloquea el cierre. Todos los internos consultan; registran movimientos Dirección, Administración y Técnico (tentativo: falta definir quién llevará el almacén). Los costos de las partes quedan pendientes. | Así el inventario inicial lo puede cargar MOT cuando quiera sin frenar las órdenes, y cada pieza tiene su historial. |
| D31 | **Filtros de cada Robox:** se registra qué filtro tiene, desde cuándo y cuándo se retiró; solo para las partes marcadas como filtro en el catálogo (hoy: SKF500/HY, SKF500/DST y sinterizado). Al cerrar una orden con Robox que usó un filtro, el sistema retira el anterior del mismo tipo e instala el nuevo. **Alerta de cambio** cuando el filtro cumple los meses del parámetro `filtro_cambio_meses` (6, editable en Parámetros) o cuando la última lectura de la pantalla marca "filter used" igual o mayor que "filter lifetime"; una lectura anterior al filtro que está puesto no cuenta. Lo registran quienes editan la flota (Dirección y Técnico; tentativo). La parte de la alerta que depende del laboratorio llega en la Etapa 4. | Es la regla de §4.4 ("a los 6 meses o antes"), sin inventar umbrales de aviso anticipado. |
| D32 | **Agenda:** una visita programada es una orden de servicio en estado "programada" (incluidas las que pide el cliente). Las **visitas recurrentes** se definen por contrato: cada cuántos días, semanas o meses y cuándo toca la siguiente. El sistema no crea órdenes solo: alguien las "programa" desde la Agenda, con lo que nace la orden y la fecha avanza un periodo. Las que ya pasaron sin programarse se marcan. Las ven todos los internos; las definen y programan Técnico y Dirección (tentativo). | Es lo más sencillo y deja a una persona decidir la fecha real y el técnico; evita órdenes automáticas que nadie pidió. |
| D33 | **Acceso a planta:** los documentos que piden las plantas son un catálogo editable, cada uno de MOT (REPSE) o por persona (equipo de protección, IMSS). Cada documento lleva vencimiento opcional y su archivo. En cada orden de visita programada o en curso se muestra lo que pide la planta y el estado de los documentos de MOT, del técnico y del acompañante: vigente, por vencer (30 días antes, editable en Parámetros), vencido o faltante. Es un aviso: no impide iniciar la orden. Los consultan todos los internos; los registran Dirección y Administración (tentativo). | Es la regla de §4.4 y coincide con el "punto de control antes de ejecutar" del manual de procesos. No se bloquea la orden porque no todas las plantas piden todos los documentos. |
| D34 | **Cargos por facturar:** al cerrar una orden de un contrato por evento, el sistema crea el cargo = volumen del reservorio × tarifa por litro (manda el volumen anotado en la visita sobre el de la ficha del equipo, y la tarifa propia del equipo sobre la general del contrato). Si falta el volumen o la tarifa, el cargo nace "por completar" en lugar de perderse. La falla "componente dañado por el cliente" no cobra sola: avisa en la orden y una persona genera el cargo y le pone precio. También se capturan cargos a mano. Todos quedan "pendientes de facturar" hasta la Etapa 5; las rentas mensuales no se manejan como cargos todavía. Los ven Dirección, Administración y Comercial; los capturan Dirección y Administración (tentativo). | Son las dos reglas de §4.4. El precio de las partes dañadas lo pone una persona porque aún no hay lista de precios de partes. |
| D35 | **Muestras:** cada muestra es de un equipo del cliente (la planta sale del equipo) y lleva tipo (virgen, usado, antes de filtrar, filtrado), quién la tomó, fechas de muestreo y recepción, nivel de análisis, ID de caso (texto, P1) y, opcionales, punto de muestreo y condición de operación de la máquina (del manual de procesos). El **ID de muestra** `AAMMDD-NNN` lo genera el sistema con la fecha de muestreo y el consecutivo del año; el laboratorio puede escribir el de muestras anteriores y el consecutivo continúa del mayor. Estados: por recibir, recibida, en análisis, concluida, cancelada; sin fecha de recepción solo puede estar por recibir o cancelada. Se liga a una orden de servicio o a una oportunidad del mismo cliente. El nivel de análisis se guarda pero aún no limita qué parámetros se capturan (P5). Las consultan todos los internos; las registran Laboratorio y Dirección (tentativo, P4). | Es el registro de §4.5. En el informe FOLAB-26-092 los consecutivos no van en orden de fecha, por eso se permite escribir el ID a mano. Exigir el equipo es lo más sencillo: el informe y las tendencias son por equipo. |
| D36 | **Resultados de laboratorio:** por muestra, un resultado por parámetro del catálogo, guardado como lo escribe el laboratorio: número con punto decimal (`0.583`), número acotado (`<300`) o texto (`No detectado`; el código de limpieza como `18/16/13`; los cualitativos, texto libre). Un número mal escrito (con comas o unidades) se rechaza en lugar de guardarse como texto. Lo que no se midió se deja vacío. La captura se guarda completa de una vez y cada cambio queda en la bitácora. Una muestra cancelada no lleva resultados. **Niveles de análisis:** cada parámetro indica en el catálogo qué niveles lo incluyen; al inicio todos incluyen todo (P5) y la captura solo avisa cuando un parámetro no es del nivel de la muestra, sin impedirlo. Capturan Laboratorio y Dirección; consultan todos los internos (tentativo, P4). Si pasa o no pasa se calcula en el paso siguiente. | Así se reproducen los valores del FOLAB-26-092 tal cual (incluidos "<300" y "No detectado") sin perder el número para evaluar y graficar. No bloquear por nivel es lo reversible mientras el laboratorio no defina P5. |
| D37 | **Evaluación y condición:** cada resultado se evalúa con la regla de su parámetro: máximo (menor que el límite), mínimo (mayor), código ISO (cada número menor o igual), nominal ± % (contra la viscosidad nominal del aceite del equipo, tomada del catálogo de aceites) y línea base ± valor o ± % (contra la muestra virgen más reciente del mismo equipo). Un texto como "No detectado" no se evalúa; un número acotado ("<300") solo cuando no deja duda. Si falta la viscosidad nominal o la muestra virgen, el resultado queda sin evaluar y se dice por qué. **Condición del aceite:** cuenta los "no pasa" de los parámetros marcados para ella en el catálogo (al inicio, los fisicoquímicos) con los umbrales de Parámetros (2 = Precaución, 5 = Crítico). **Condición de aditivos:** igual con los aditivos, solo Normal o Precaución, y no aplica a la muestra virgen. El desgaste y los contaminantes se evalúan pero no cuentan. Nada de esto se guarda: se calcula al mostrar, así un cambio de límite se refleja de inmediato; el informe (paso 4) fijará lo que se publique. Tentativo (P6). | Con estas reglas el sistema da las mismas condiciones que el informe FOLAB-26-092 en sus seis muestras, usando la viscosidad del aceite real (ISO 46) en lugar del "68 ± 10 %" del informe. Si el desgaste contara, la última muestra daría Precaución y el informe dice Normal. |
| D38 | **Informe por equipo:** reúne muestras de un solo equipo (la base impide mezclar equipos). Al crearlo se incluyen todas las muestras del equipo que ya tienen resultados; después se puede quitar o agregar alguna. Muestra la **tabla de tendencias** (una columna por muestra, de la más antigua a la más reciente; un renglón por parámetro), la condición del aceite y de aditivos de cada muestra, el límite y la **desviación** de la última muestra contra la de aceite usado o contra la virgen, según el parámetro. La **condición general** es la peor entre la del aceite y la de aditivos de la última muestra. El **folio** es texto libre; se propone con el consecutivo de la última muestra (`FOLAB-26-092`) y no se repite. **Validación:** en borrador el informe se calcula con los resultados y límites vigentes; al validarlo se guarda una copia fija y ya no cambia aunque después se corrijan resultados o límites. Para corregirlo se reabre, lo que borra la validación. Queda anotado quién lo elaboró, quién lo validó y cuándo. Elaboran, validan y reabren Laboratorio y Dirección, y puede ser la misma persona; consultan todos los internos (tentativo, P4). La publicación al cliente llega con el portal y solo aplicará a informes validados. | Es el informe de §4.5 con el formato del FOLAB. Fijar el contenido al validar es lo que hace confiable un informe ya entregado. La condición general y el folio siguen el informe de ejemplo mientras MOT confirma P1 y P6. |
| D39 | **Gráficas de tendencia:** el informe lleva una gráfica pequeña por cada parámetro con al menos dos valores numéricos, con las muestras de la más antigua a la más reciente, agrupadas como la tabla (fisicoquímicos, desgaste, aditivos, contaminantes). Cada una dibuja su límite cuando cabe en la escala y marca con un punto hueco en rojo lo que no pasa; al tocar un punto se lee su valor y su muestra. La línea se corta donde falta una muestra. Los parámetros en cero en todas las muestras solo se nombran. El código de limpieza no se grafica (no es un número); lo cubren las tres gráficas de partículas. | El Excel de MOT junta varios parámetros por gráfica; aquí va uno por gráfica porque sus escalas son muy distintas (partículas en millones, metales en decenas) y juntos los valores chicos se verían planos. Cubre las mismas familias que pide §4.5. |
| D40 | **PDF del informe:** hoja carta horizontal con la estructura del "Análisis de tendencias en aceites" de MOT: encabezado con folio, fecha de emisión y condición general; información del cliente, de la última muestra y del equipo (lo que falta dice "No disponible", como en el informe actual); tabla de tendencias con lo que no pasa en rojo, límite y desviación; las notas de método al pie, tomadas del informe de MOT; gráficas de tendencia; observaciones, y quién elaboró y quién validó. Un informe sin validar se puede imprimir para revisarlo, pero dice "BORRADOR SIN VALIDAR". Si el informe tiene más de 8 muestras se imprimen las 8 más recientes y se avisa. Lo descarga quien puede ver el informe. No incluye las hojas de FTIR ni de colorimetría del informe actual: son imágenes del laboratorio que el sistema aún no guarda. | Mismo patrón que la cotización y la orden: los datos se arman aparte del dibujo. El PDF validado sale de la copia fija, así que no cambia con el tiempo. Las imágenes de FTIR y colorimetría quedan para cuando MOT confirme si las quiere en el sistema. |
| D41 | **Laboratorio y el resto del sistema.** (1) **Cambio de filtro por laboratorio:** el informe tiene una casilla "Recomendar el cambio de filtro del Robox". Cuando el informe se valida, el Robox que atiende ese equipo (lo tiene en su carrusel) muestra la alerta de cambio, con el folio del informe; deja de mostrarla cuando se le instala un filtro ese día o después, o cuando un informe validado más reciente del mismo equipo ya no lo recomienda. La recomendación también sale en el PDF. (2) **Pipeline:** las muestras ligadas a una oportunidad se ven en su ficha, y un aviso dice cuándo conviene mover la etapa (ya hay muestra registrada; el laboratorio ya concluyó el análisis). El sistema no mueve la etapa solo. | "Si el laboratorio lo indica" (§4.4) se toma literal: lo indica una persona del laboratorio, no un umbral inventado. Mover la etapa sigue siendo decisión de quien lleva la venta. |
| D42 | **Facturación sin PAC por ahora (17 nov 2026).** Mientras MOT reúne lo del PAC (P8), la factura se sigue timbrando fuera del sistema y aquí se registra a mano: folio, UUID, XML y PDF. Cargos, facturas en borrador, pagos y cobranza se construyen completos, de modo que al llegar el PAC solo se sustituya ese paso manual por el timbrado. Todo desarrollo con PAC se hará en su ambiente de pruebas; la primera factura real se emite solo con autorización expresa. **Condiciones de crédito:** una por razón social, con días de crédito (0 = de contado), si exige orden de compra, método de pago (PUE o PPD) y forma de pago del SAT (con PPD, 99), contacto de cuentas por pagar y portal de proveedores. Una razón social sin condiciones capturadas aparece como "sin definir", no como de contado. Las consultan Dirección, Administración y Comercial; las capturan Dirección y Administración; Técnico y Laboratorio no ven nada de facturación (tentativo, P4). El IVA será un parámetro (16 %). Las rentas se generarán con un botón, por el mes que se elija, hasta saber si se facturan por adelantado o vencidas. | Decidido con Rivexo para no detener la etapa por el PAC. La tabla de condiciones va aparte de las razones sociales porque no la ve todo el que ve clientes. |
| D43 | **Rentas como cargos:** cada tarifa mensual de un contrato vigente genera un cargo de renta por mes (en una renta hay una tarifa por Robox, D18). La pantalla "Rentas del mes" muestra, para el mes que se elija, qué rentas tocan, cuáles ya están generadas y cuánto suman; un botón genera los cargos que falten. Pedirlo dos veces no duplica: una tarifa se cobra una sola vez por mes. Cuenta un contrato si su vigencia toca ese mes; un contrato en borrador, terminado o cancelado no genera. El cargo toma el precio y la moneda del contrato y la orden de compra que cubre la tarifa. Si el contrato empieza o termina dentro del mes, se cobra el mes completo y el cargo lo avisa en sus notas. Una renta cancelada no se vuelve a generar sola. No hay generación automática: la emisión recurrente es de la Etapa 6. Las generan Dirección y Administración; Comercial las consulta. | Es el cargo de "renta mensual" de §4.6. Falta saber si se factura por mes adelantado o vencido y cómo se cobra un mes incompleto (P8); por eso se elige el mes a mano y no se prorratea. |
| D44 | **Facturas en borrador:** una factura se arma eligiendo cargos pendientes de un cliente; todos sus conceptos vienen de cargos (lo que no nace de un contrato o de una orden se captura primero como cargo). Lleva una sola moneda: si el cliente tiene cargos en dos monedas, son dos facturas. No entran cargos por completar, cancelados ni de otro cliente. Al armarla toma de la razón social el uso de CFDI, y de sus condiciones de crédito el método y la forma de pago y los días de crédito; si todos los cargos son de una misma orden de compra, propone su número. El IVA se calcula por concepto con la tasa del parámetro `iva_tasa` (16 %). Un cargo tomado por una factura no entra en otra ni se puede cambiar; al quitarlo de la factura o eliminar el borrador vuelve a quedar por facturar. En el borrador se corrigen fecha, tipo de cambio, método y forma de pago, uso de CFDI, días de crédito, orden de compra y, por concepto, la descripción y las claves del SAT. La ficha muestra el vencimiento (fecha más días de crédito), los totales y la lista de lo que falta para timbrar. Arman y corrigen Dirección y Administración; Comercial consulta. | Es "cargos → facturas" de §4.6. Tomar el cargo evita cobrar dos veces lo mismo. Las claves del SAT y el criterio del tipo de cambio los define el contador de MOT (P8), por eso son campos libres y pueden quedar vacíos en el borrador. |
| D45 | **Registro de la factura emitida (mientras no hay PAC):** cuando la factura ya se timbró fuera del sistema, en el borrador se captura serie (opcional), folio, folio fiscal (UUID), fecha de emisión y, si no es en pesos, el tipo de cambio. Con eso queda **emitida**: ya no se puede cambiar, sus cargos pasan a "facturado" y desde su fecha corren los días de crédito. Un folio fiscal no se repite en dos facturas. A la emitida se le suben su **XML** y su **PDF**, una vez cada uno. El sistema lee el XML y lo rechaza si no es de esa factura (otro folio fiscal, otro RFC u otra moneda); si su total difiere del que calculó el sistema por más de un centavo, lo guarda y lo avisa en la ficha. Mientras no tenga XML, se puede corregir un dato mal capturado del registro. **Cancelación:** se registra con su motivo cuando la factura ya se canceló ante el SAT (el sistema no la cancela allá); queda cancelada con sus datos y archivos, y sus cargos vuelven a quedar por facturar. Queda anotado quién registró y quién canceló. Registran y cancelan Dirección y Administración; Comercial consulta y descarga. Una factura registrada así lleva la marca "timbrada fuera del sistema"; cuando haya PAC, el timbrado llenará esos mismos datos. | Es la forma de no detener la etapa por el PAC (D42) sin perder el control de qué está facturado. Leer el XML evita el error más probable de una captura a mano: ligar el archivo o el folio fiscal equivocado. |
| D46 | **Pagos:** un pago se registra con fecha, monto, forma de pago del SAT (nunca "99 por definir"), referencia y, opcional, el tipo de cambio con que se pagó. Es de una razón social y una moneda, y se aplica a facturas emitidas de esa misma razón social y moneda: a una o a varias, completas o en parte. Lo que no se aplica queda **por aplicar** y se puede aplicar después a otra factura. No se puede aplicar más de lo recibido ni más del saldo de la factura. El **saldo** de una factura es su total menos lo aplicado, y de ahí sale su estado de cobro: por cobrar, pago parcial o pagada. Una factura con pagos no se cancela sin quitarlos antes. Un pago capturado por error se elimina y sus facturas recuperan el saldo, salvo que ya tenga complemento. **Complemento de pago (REP):** por ahora se timbra fuera del sistema y en el pago se registra su folio y su folio fiscal; el sistema avisa cuando hace falta (el pago cubre una factura PPD). **Pago en pesos de una factura en dólares:** el pago se registra en dólares, por lo que cubre, y se anota el tipo de cambio con que se pagó. Registran Dirección y Administración; Comercial consulta. | Cubre "pagos" de §4.6 sin PAC (D42). Aplicar solo entre la misma moneda es lo más sencillo y reversible mientras el contador define el criterio del tipo de cambio en pagos (P8). |
| D47 | **Pagos únicos y anticipos.** (1) Las tarifas de **pago único** del contrato (D20: anticipo, instalación) se vuelven cargos desde la ficha del contrato, con un botón por cada una; se cobran una sola vez y solo si el contrato está vigente. La tarifa lleva una casilla "es un anticipo". (2) El **anticipo se factura aparte**: no se mezcla en una factura con otros cargos. Se emite y se cobra como cualquier factura. (3) **Aplicación:** lo que el cliente ya pagó de un anticipo se descuenta después de otras facturas de la misma razón social y moneda, desde la factura que lo recibe, en una o varias partes. No se aplica un anticipo sin pagar ni más de lo disponible. La aplicación queda como un pago con forma "30 · Aplicación de anticipos" del SAT, ligado a su anticipo, y baja el saldo de la factura. Deshacerla devuelve lo disponible. El pago de un anticipo ya aplicado no se elimina. (4) Cada anticipo muestra cuánto se pagó, cuánto se ha aplicado, a qué facturas y cuánto queda. (5) **Parte fiscal:** el CFDI del anticipo y el CFDI de egreso de cada aplicación se timbran fuera del sistema; aquí se registra su folio y folio fiscal. Generan cargos, facturan y aplican Dirección y Administración; Comercial consulta. | Es "anticipos de renta y su aplicación a facturas" de §4.6, llevando el control del dinero sin fijar todavía el procedimiento fiscal, que define el contador (P8). Tratar la aplicación como un pago con forma 30 reutiliza saldos y candados de los pagos y es la forma que el SAT prevé para ese caso. |
| D48 | **Cobranza.** (1) **Cuentas por cobrar:** pantalla con las facturas emitidas que tienen saldo. La **antigüedad de saldos** va por razón social y por moneda (no se suman monedas distintas), en tramos por días de atraso: por vencer, 1 a 30, 31 a 60, 61 a 90 y más de 90. El atraso se cuenta desde el vencimiento (fecha de la factura más sus días de crédito). No se guarda: se calcula al consultar con el saldo del momento. (2) **Saldo de la orden de compra:** su monto menos lo facturado contra ella (sin IVA, solo facturas emitidas, por los cargos que esa orden cubre). Si se factura de más, el contrato lo avisa como "excedida"; el sistema **no impide** facturar. Una orden sin monto solo dice cuánto lleva facturado. (3) **Portal de proveedores:** en cada factura emitida se anota cómo va en el portal del cliente (pendiente de subir, subida, aprobada, programada para pago, pagada), con sus fechas y notas. Es un registro a mano: el sistema no se conecta a ningún portal. Se ofrece en las razones sociales marcadas "usa portal de proveedores" y se puede abrir en cualquier otra factura. Lo consultan Dirección, Administración y Comercial; lo actualizan Dirección y Administración. | Son los tres pendientes de §4.6. Los tramos de 30 días son los usuales en México; si administración usa otros, se cambian en un solo lugar. Se supone que el monto de la orden de compra es antes de IVA, como las tarifas (confirmar con MOT). Avisar en vez de bloquear deja a administración decidir cuando el cliente amplía la orden después. |
| D49 | **Pipeline: tablero completo y tipos de venta.** (1) El tablero de oportunidades muestra todo el proceso en una sola vista, hasta **Ganada** y **Perdida** (antes terminaba en Seguimiento y las cerradas estaban en otra pantalla). Las ganadas y perdidas se quedan 90 días a la vista; el historial completo sigue en "Historial de cerradas". (2) Tres **tipos de oportunidad**: cliente nuevo, ampliación (*up sell*: más de lo mismo a un cliente actual, como otro Robox u otra planta) y venta cruzada (*cross sell*: otro servicio a un cliente actual). El tablero se filtra por tipo y cada tarjeta lo dice. La etapa "Seguimiento" se conserva. | Pedido por Alejandro el 19 nov 2026 para la presentación a MOT. Las etapas las confirmó el director comercial, así que quitar "Seguimiento" se le pregunta a él. Los 90 días son un criterio de pantalla, no una regla de negocio: se cambian en `DIAS_CERRADAS_EN_TABLERO`. |
| D50 | **Prospecto o cliente.** No se captura: el sistema lo deduce de los contratos de la cuenta. **Cliente:** tiene algún contrato vigente. **Cliente anterior:** tuvo contrato (terminado) y hoy no tiene ninguno vigente. **Prospecto:** nunca ha tenido contrato en firme; los borradores y los cancelados no cuentan. La lista de Clientes lo muestra como etiqueta y se filtra por tipo. Una cuenta se da de alta igual sea prospecto o cliente. | Pedido por Alejandro el 19 nov 2026. Deducirlo evita un dato más que alguien tendría que mantener al día y que podría contradecir a los contratos. |
| D51 | **Rentas a mes vencido.** La renta de un mes se factura al terminar ese mes, no por adelantado. | Confirmado por Fernando y Juan Pablo en la revisión del 20 nov 2026. "Rentas del mes" ya propone el mes que acaba de terminar (D57). |
| D52 | **Por litro se cobra el reservorio completo**, no los litros que pasaron por el filtro: el aceite da varias vueltas por el Robox. El precio de referencia, cuando el cliente no comparte lo que paga por su aceite, es el precio económico de mercado; MOT cobra alrededor de 30 % menos. | Confirmado por Juan Pablo el 20 nov 2026. Coincide con lo construido (cargo = volumen del reservorio × tarifa; cotizador al 70 % con piso). Elegir renta o por litro es criterio comercial; MOT prefiere por litro porque deja más. |
| D53 | **Laboratorio: los resultados se capturan a mano**, como hoy (de la bitácora al sistema). Leerlos directo de los equipos queda para después: los de número ácido y humedad solo tienen USB o salida de teclado. **Los límites por parámetro son los mismos para todos los aceites.** | Acordado con Evelyn y Fernando el 20 nov 2026. Fernando enviará soporte técnico para revisar la conexión de los equipos. |
| D54 | **Quién hace qué** (20 nov 2026): comercial, Juan Pablo (y Edgar, el otro vendedor); agenda y órdenes de servicio, Daniel y Erika; flota de Robox, la opera Daniel y la deciden Fernando y Juan Pablo según lo comercial; laboratorio, Evelyn; cargos, facturas, pagos y cobranza, Claudia (con Fernando). | Definido por Fernando. Faltan los usuarios de Claudia, Erika y Edgar (P20). |
| D55 | **Pipeline: descartar y siguiente paso.** (1) Nueva etapa de cierre **Descartada**: el prospecto no va (ya tiene servicio, sin presupuesto, no le interesa). No es una venta perdida, porque nunca hubo una oportunidad real. Pide motivo, de la misma lista que las perdidas o escrito; se agregó "Sin presupuesto por ahora". Se puede retomar moviéndola a una etapa abierta. En el tablero comparte la última columna con Perdida. (2) Cada oportunidad lleva un **siguiente paso** con fecha, opcional. Cuando la fecha llega aparece en rojo en su tarjeta y cuenta en Inicio como "Seguimientos por hacer". Avisa en las abiertas y también en las descartadas, para el caso "sin presupuesto este año, retomar en enero"; en ganadas y perdidas ya no. | Pedido por Juan Pablo el 20 nov 2026. Reusar la lista de motivos evita un catálogo más. El aviso en descartadas es decisión de Rivexo: sin él, descartar a un prospecto por presupuesto haría que se olvidara. |
| D56 | **Datos de instalación del sitio.** Cada equipo del cliente guarda lo que Operación necesita saber antes de llevar el Robox: conexiones disponibles, distancia al reservorio (metros), voltaje y corriente. Son opcionales. Los captura quien edita clientes (Comercial y Dirección), en la visita. La planta avisa qué falta en cada equipo, y la orden de servicio los muestra, también en el celular del técnico. Solo avisa: no impide crear la orden ni asignar el Robox. | Pedido por Daniel el 20 nov 2026: llegar sin la manguera (3 a 6 m) o la conexión correctas echa a perder la visita. Voltaje y corriente van como texto, como los dice la planta, para no forzar un formato. |
| D57 | **Cuenta bancaria del pago y mes de las rentas.** (1) Catálogo de **cuentas bancarias de MOT** (nombre para reconocerla, banco, últimos 4 dígitos y moneda), que llenan Dirección y Administración. Al registrar un pago se puede indicar a cuál cayó; es opcional y, si no hay cuentas dadas de alta, el formulario no lo pregunta. Solo se guardan los últimos 4 dígitos: nunca el número completo ni la CLABE. (2) "Rentas del mes" abre en el **mes que acaba de terminar** y lo dice en pantalla, porque las rentas se facturan a mes vencido (D51). Se sigue pudiendo elegir otro mes. | Lo de la cuenta lo propuso Alejandro en la revisión del 20 nov 2026 (MOT puede cobrar en más de una cuenta). Guardar solo la terminación basta para conciliar y evita tener datos bancarios completos en el sistema. |
| D58 | **Rol de Coordinación.** Sexto rol interno, para quien programa las visitas y lleva las órdenes de servicio desde la oficina (Erika). Crea órdenes, las asigna a un técnico y corrige cualquiera; programa las visitas recurrentes. Consulta clientes, contratos (sin precios), flota, inventario, documentos de acceso y laboratorio. No ve precios, cargos, facturación, oportunidades, parámetros ni usuarios, y no edita clientes, flota ni inventario. | Confirmado por Alejandro el 21 nov 2026, a partir de lo que dijo Fernando ("agenda y órdenes las ven Dani y Erika"). Como el permiso de crear órdenes es el mismo que habilita llenarlas, Coordinación también aparece en la lista de técnicos y ve la sección Campo; no estorba y evita un permiso más. |
| D59 | **Usuario compartido de Administración y Coordinación.** Claudia (facturación y cobranza) y Erika (agenda y órdenes) entran con un mismo usuario, `contabilidad@molecular.mx`. Como cada usuario lleva un solo rol, existe el rol **Administración y coordinación**, que es la suma exacta de los permisos de los dos y nada más. Los roles Administración y Coordinación se conservan por si después se separan. | Decisión de MOT, comunicada por Alejandro el 24 nov 2026. Costo conocido: la bitácora y el "quién lo hizo" de órdenes, facturas y pagos dirán ese usuario, sin distinguir cuál de las dos personas fue. |
| D60 | **Estado "Bloqueado" del Robox.** Quinto estado: la unidad está en el almacén pero apartada para un cliente o un proyecto, así que no debe ofrecerse a otro. Lo pone a mano quien edita la flota (Dirección y Técnico) y para quién está apartada va en las notas. Un Robox bloqueado sí se puede asignar a un contrato (pasa a "En cliente"); al terminar esa asignación vuelve a "Disponible", no a bloqueado. Solo avisa: el sistema no impide asignarlo a un cliente distinto del que lo apartó. | Pedido por Alejandro el 24 nov 2026, al cargar el inventario de MOT, que ya usa "Bloqueado, para X" (14 de 100 unidades). Resuelve en parte P14; sus demás estados (Operando, Reparación, Retirado) siguen por decidir. |
| D61 | **Historial de almacén del Robox.** Tabla aparte (`robox_historial`) con lo que MOT lleva en la hoja "Movimientos" de su inventario: alta en almacén, salida (con su pase de salida), entrada, limpieza y reparación, con fecha, detalle y anotaciones. Se ve en la ficha de cada Robox, lo más reciente primero. Es un registro: se agrega, no se corrige ni se borra. Lo consulta quien ve la flota; lo registra quien la edita. Desde la ficha del Robox se registran movimientos nuevos ("Registrar movimiento de almacén"): tipo, fecha (no futura), detalle, pase de salida u otro documento, y anotaciones; solo el tipo y la fecha son obligatorios. Registrar un movimiento no cambia el estado del Robox ni numera el pase: el folio se escribe a mano. | Pedido por Alejandro el 24 nov 2026. No cabía en `movimientos_robox`, que son los cambios de equipo dentro de un contrato. Si MOT quiere dejar el Excel, el siguiente paso es la captura de estos movimientos (con folio de pase de salida) desde la ficha. |
| D62 | **Portal de clientes: acceso.** Un usuario del portal es una persona del cliente ligada a una sola cuenta (`usuarios_portal`) y ve todo lo de esa cuenta (todas sus plantas y razones sociales); restringir por planta queda para después. Lo da de alta quien administra usuarios (hoy Dirección) desde la ficha del cliente, con contraseña temporal; se le quita el acceso desactivándolo, no borrándolo. El cliente solo consulta. Nunca lee las tablas internas: lo que ve se lo dan funciones `portal_*` que devuelven solo las columnas que le tocan. Los informes de laboratorio se publicarán a mano; facturas emitidas y órdenes cerradas aparecerán solas. |
| D63 | **Portal: informes de laboratorio.** El cliente ve los informes validados que MOT publique (`informes.publicado_at`), con su tabla de tendencias, gráficas y el mismo PDF que imprime MOT. Publica y retira quien valida informes (Laboratorio y Dirección), desde la ficha del informe; validar no publica y reabrir retira. Ve las anotaciones de cada muestra y las observaciones, porque ya van en el PDF; no ve borradores ni muestras sueltas. |
| D64 | **Portal: facturas y pagos.** El cliente ve las facturas emitidas de su cuenta (no borradores ni canceladas) con total, pagado, saldo y vencimiento; sus conceptos; los pagos aplicados con su complemento, y descarga el XML y el PDF que MOT haya subido. En "Pagos" ve cada pago con las facturas a las que se aplicó. Aparecen solas al emitirse; no hay paso de publicar. No ve notas internas ni a qué cuenta de MOT cayó el pago, y no paga ni sube nada desde el portal. |
| D65 | **Portal: órdenes de servicio.** El cliente ve las visitas cerradas en sus plantas (fecha, planta, equipo, técnico) y abre su reporte en PDF, que es el mismo formato "Servicio RecondOil Box" con las dos firmas. Aparecen solas al cerrarse. No ve visitas programadas, en curso ni canceladas, servicios de taller, las notas internas de la orden ni las fotos de la visita (se decidirá si se le muestran). |
| D66 | **Portal: inicio y cierre.** El inicio es un resumen de la cuenta: último informe publicado con su condición, saldo por pagar por moneda (y lo vencido) y última visita. El portal lleva su propio menú (Inicio, Laboratorio, Facturas y pagos, Órdenes de servicio). Una prueba recorre todas las tablas y vistas del esquema y exige que un usuario del portal solo vea su perfil, su rol y su liga a la cuenta: si una tabla nueva se abre por error, la prueba falla. |
| D67 | **Pantalla de bitácora.** Solo Dirección (`bitacora.ver`). Lista de lo más reciente a lo más antiguo, 50 por página, con filtros por tabla, quién, tipo (alta, cambio, baja) y rango de fechas; cada renglón abre el detalle campo por campo (antes y después) y de ahí se ve el historial completo de ese registro. Solo se consulta. Los nombres de los campos se muestran como están en la base, sin traducir uno por uno. |
| D68 | **Tablero de dirección.** Pantalla "Dirección" con permiso propio (`direccion.ver`): Dirección, Administración (y el rol combinado con Coordinación) y Comercial. Nada se guarda: se calcula al consultar. Dólares y pesos van por separado, sin convertir. Paso 1: facturado del mes (sin IVA), cobrado del mes, renta mensual vigente, por cobrar con lo vencido y por facturar, más la gráfica de facturado y cobrado de los últimos 12 meses (las dos con IVA, para compararlas). "Por facturar" cuenta los cargos pendientes, sueltos o en un borrador de factura. La rentabilidad por planta queda para cuando exista el costeo (D69). | Confirmado por Alejandro el 26 nov 2026. |
| D69 | **Costeo, primera versión (por construir).** Se capturan todos los costos en un registro simple. Un costo puede ir ligado a un Robox (por ejemplo su reparación) y por él al cliente y la planta donde está, o quedar como gasto general sin cliente. En una segunda etapa se decide cómo repartir los generales (por máquina, por cliente o absorbidos entre todo). | Definido por Alejandro el 26 nov 2026. |
| D70 | **Corte mensual.** Todo se factura a mes vencido con corte mensual, sea renta de máquina o limpieza por litro: al terminar el mes se generan las rentas de ese mes y se facturan junto con los cargos por litro de las visitas cerradas en el mes. Durante el mes los cargos por litro se acumulan como pendientes. | Confirmado por Alejandro el 26 nov 2026; amplía D51. |
| D71 | **Correcciones de la revisión de código (26 nov 2026).** (1) Una orden no se da de alta cerrada ni cancelada, una factura nace siempre en borrador y un cargo nunca nace facturado: esos estados solo se alcanzan por el camino que los valida. Una factura eliminada no se recupera. (2) La renta de un mes la debe también el contrato que se dio por terminado después, si su fecha de término cae en ese mes o más adelante; terminado y sin fecha de término no genera. (3) Una asignación de Robox no acepta fechas futuras: "Hasta" se llena el día que regresa. (4) La aplicación de un anticipo no se quita de una factura suelta: se deshace completa. (5) Al salir de la captura, lo pendiente se envía de inmediato. | Hallazgos de la revisión; (2) sigue de D51 y D70 y sustituye a "terminado no genera" de D43. |
| D72 | **Tablero: ingresos por cliente y planta.** Por cada moneda, una lista de clientes con sus plantas: Robox que tienen hoy, renta mensual vigente, lo facturado sin IVA en los últimos 12 meses y el saldo por cobrar con lo vencido. La planta de lo facturado sale del contrato del cargo o, si no tiene, de su orden de servicio; sin ninguna, queda "Sin planta". El saldo es del cliente completo, no de cada planta, porque una factura puede traer cargos de varias. Un cliente que solo debe también aparece. La rentabilidad se agregará con el costeo (D69). | Paso 2 del tablero. |

---

## 8. Manual corporativo de procesos (noviembre de 2026)

MOT compartió el documento "Sistema de procesos operativos" (propuesta de un consultor). Describe cinco procesos: inventario de maquinaria, instalación, mantenimiento, retiro y laboratorio, cada uno con actividades, responsables, formatos (F-01 a F-25) e indicadores. El propio documento aclara que el proceso 1 parte de instrucciones de MOT y que los procesos 2 a 5 son propuestas por validar con la operación real. Por eso **no se toma como regla de negocio**: lo que cambia el sistema quedó como preguntas P12 a P16.

**Lo que el sistema ya cubre**

| Manual | En el sistema |
|---|---|
| F-01 Inventario maestro y expediente por máquina | Flota: ficha de cada Robox con ubicación calculada, asignaciones, carrusel, filtros e historial. |
| F-03 Movimiento de maquinaria | Movimientos del Robox entre tanques y asignaciones a contratos (sin autorización previa: ver P12). |
| F-04 Calendario / F-10 Programa de mantenimiento | Agenda y visitas recurrentes por contrato. |
| F-11 Orden de trabajo, F-12 Reporte de falla, F-14 Reporte correctivo | Orden de servicio con actividades, fallas, partes usadas, lecturas, fotos y firmas. |
| Registro de piezas y consumibles | Inventario y partes usadas en la orden. |
| Evidencia documental (fotos, firmas, reportes) | Fotos, firmas y PDF de la orden. |
| Punto de control "antes de ejecutar: validación documental" | Tarjeta "Acceso a planta" en cada orden de visita (D33). |
| Control jurídico: contrato, modalidad y vigencia por equipo | Contratos (comodato = renta, D14) con sus Robox asignados. |

**Lo que no está y se decidirá con MOT:** el rol de Gerente de Operaciones y sus autorizaciones (P12), el identificador `MOL-001` (P13), los estados y horas de máquina (P14), los checklists y actas de instalación y retiro (P15), y prioridad, tiempos de paro y liberación en mantenimiento (P16).

**Para etapas siguientes:** el proceso 5 (folio único de muestra, punto de muestreo, custodia, reporte de no conformidad, parámetros de aceptación según el aceite) se revisa al planear la Etapa 4. El tablero ejecutivo y los indicadores (disponibilidad, cumplimiento de mantenimiento, MTTR, MTBF, instalaciones a tiempo) son de la Etapa 6.

**Proceso 06, gestión comercial y ventas (26 nov 2026):** llegó como propuesta 1.0, aún sin validar por los dueños. Lo que el sistema ya cubre: registro de prospectos con planta, contactos y origen; tablero de oportunidades con responsable; siguiente paso con fecha y aviso cuando vence (D55); pérdida y descarte con motivo; muestras de diagnóstico ligadas a la oportunidad; cotización con precio piso (D10 a D17); la regla de que ganar no basta sin contrato (D11); contratos, condiciones de crédito y anticipos. Lo que propone y no existe: sus nueve etapas (las actuales se acordaron con MOT el 20 nov), importe estimado, probabilidad y fecha estimada de cierre (de ahí salen el pipeline ponderado y el pronóstico), prioridad A/B/C con matriz de seis criterios, impedimento, bitácora de contactos, semáforo por días en la etapa, checklist de entrega a Operaciones, seguimiento posventa y aviso de renovación a 90, 60 y 30 días, y un tablero de indicadores para Dirección. Nada de esto obliga a rehacer lo construido: son campos y pantallas que se agregan. No se construye hasta que MOT lo valide (P24); los indicadores caben en el tablero de dirección de la Etapa 6.

---

## 8 bis. Revisión de código (26 de noviembre de 2026)

Se revisó todo el código en tres frentes (seguridad y permisos, dinero y facturación, operación y laboratorio). No se encontraron fugas de datos entre clientes ni de precios a roles sin permiso. Lo corregido está en D71. Queda pendiente, por orden de importancia:

| Pendiente | Qué pasa hoy |
|---|---|
| Captura de una orden desde dos teléfonos a la vez | Cada envío reemplaza toda la captura: si el técnico y su acompañante la abren al mismo tiempo, el último que guarda pisa lo del otro. Mientras se corrige: una sola persona captura cada orden. |
| Tarifas sin fechas | Una renta que se agrega o se elimina de un contrato cuenta (o deja de contar) para el mes vencido que aún no se genera. Conviene generar las rentas del mes antes de cambiar tarifas. |
| Terminar o eliminar un contrato | No avisa si tiene visitas recurrentes o un Robox asignado; hay que quitarlos a mano. |
| Saldo de la orden de compra con anticipo | El anticipo y las rentas a las que se aplica cuentan los dos contra la misma orden de compra, así que puede salir "excedida" sin estarlo. Depende de cómo maneje fiscalmente el anticipo el contador (P8). |
| Listas muy largas | Órdenes, muestras y lecturas se leen completas; al pasar de unos 1,000 renglones habrá que paginarlas. Hoy hay decenas. |
| Detalles | El seguimiento de una oportunidad descartada hace más de 90 días se cuenta en Inicio pero no aparece en el tablero (sí en el historial). Inicio no cuenta las órdenes donde el técnico va de acompañante. Una visita mensual programada para el día 31 se recorre al 28. El nombre de quien firma no se guarda hasta que dibuja su firma. El PDF de una orden sin captura muestra los datos propuestos del Robox. Una cotización puede insertarse como aceptada por la API. |

---

## 9. Revisión con MOT (20 de noviembre de 2026)

Primera revisión del sistema con Fernando (Dirección), Juan Pablo (Comercial), Daniel (Operación) y Evelyn (Laboratorio). Se mostró todo lo construido (Etapas 0 a 5) y se hizo el levantamiento por área. Las decisiones están en D51 a D54; las dudas nuevas, en P20 a P23.

**Lo que confirmaron tal como está:** las etapas del pipeline (se pueden saltar; ya se propone visita y prueba con un Robox sin muestra inicial), up sell y cross sell (renta y por litro son las dos variantes), el cobro por litro sobre el reservorio completo, la captura de la visita en el celular (temperatura, presión, flujo y volumen acumulado), el carrusel (Rassini BYPASA rota el Robox cada mes entre máquinas con el mismo aceite), el seguimiento manual de portales y que casi todos los clientes fijos piden orden de compra y portal (GOPLAS no).

**Lo que pidieron y hay que construir:**

| Qué | Quién | Dónde cae |
|---|---|---|
| Descartar un prospecto con su motivo (ya tiene servicio, sin presupuesto, no le interesa), distinto de una venta perdida | Juan Pablo | Hecho (D55) |
| Retomar después: prospectos sin presupuesto este año, con fecha para volver a buscarlos | Juan Pablo | Hecho (D55): siguiente paso con fecha |
| Datos de instalación del sitio antes de llevar el Robox: voltaje, corriente, distancia al reservorio, conexiones, largo de manguera (3 a 6 m) | Daniel | Hecho (D56) |
| Requisitos de seguridad por planta (cofia y sin anillos en GOPLAS; casco, chaleco y botas en Nacobre; alta del IMSS en Condumex) | Daniel, Fernando | Ya existe (requisitos de planta). Falta cargarlos: Daniel manda el Excel |
| IMSS, REPSE y demás papeles consultables en el celular para enseñarlos en la caseta | Fernando | Ya existe (documentos de acceso). Falta revisar que se abran cómodo desde `/campo` y subir los archivos |
| Robox comodín para sustituir en campo una unidad con falla compleja | Fernando, Daniel | Flota. Depende de P22 |
| Rentas a mes vencido | Fernando | Hecho (D57): la pantalla propone el mes vencido |
| En el pago, a qué cuenta bancaria cayó | Alejandro | Hecho (D57). Falta que MOT dé de alta sus cuentas en Catálogos |
| Elegir si el informe de laboratorio se manda al cliente solo o a mano | Fernando | Etapa 6 (envío por correo) |
| Portal de clientes: facturas abiertas, pagos e histórico de laboratorio con gráficas de tendencia (por ejemplo, desgaste de metales) | Fernando | Etapa 6. Las facturas en parcialidades y sus complementos deben verse ahí |
| Leer los resultados directo de los equipos de laboratorio | Fernando | Más adelante (D53) |

**Lo que MOT quedó de entregar:** Fernando, los datos del PAC y el sello digital para timbrar (el `.cer` y el `.key` se cargan en el PAC, no se mandan por chat ni entran al repositorio) y los números de serie, modelos, años y versión de programa de los Robox; Daniel, el inventario de Robox (en clientes y en la bodega) y los requisitos de acceso por planta; Evelyn, validar con su usuario que los campos de captura alcanzan para sus informes; el grupo, los criterios de las visitas recurrentes (P21).

**Lo que quedó de hacer Rivexo:** accesos para Evelyn y Daniel (entregados), capacitación de operación con Daniel, cargar el inventario de Robox cuando llegue, y una capacitación general al terminar los ajustes. Se abre un grupo de chat con Fernando, Claudia, Erika y Alejandro para soporte.

**Carga del inventario de Robox (24 nov 2026).** Se cargaron en `mot-dev` los 100 Robox del archivo "BC-PRO03 Inventario de RoBOX, revisión 4" que entregó MOT (número de serie, modelo y fecha de alta). El archivo está actualizado al 22 de octubre de 2025, así que la ubicación de cada uno puede haber cambiado: quedó escrita en las notas del Robox, con esa fecha, para que Operación la confirme. Equivalencias usadas, porque el sistema tiene cuatro estados y el archivo seis (P14 sigue abierta): Servicio a cliente y Prueba tecnológica → En cliente (36); Almacén → Disponible (32); Bloqueado, casi todos "para Ediplast" → Disponible con la nota del bloqueo (14; desde D60 existe el estado Bloqueado y esos 14 se pasan a él); Limpieza/Reparación → En taller (13); Vendido → Baja (5). Canisters y bomba van en las notas (también se leen en el modelo). No se crearon asignaciones a contratos: los 36 "en cliente" dicen en su nota con quién están y falta asignarlos. La hoja de movimientos (240 renglones, del 28 ago 2023 al 30 oct 2025) se carga aparte, en el historial de almacén (D61). Varios clientes del archivo no existen aún en el sistema: Envases Universales, Nacobre Vallejo, Ediplast, CFE Malpaso, Ferromex, Compartec y los de equipos vendidos.
