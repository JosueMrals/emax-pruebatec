# EnerFactura — Prueba técnica Grupo EMAX

Prototipo funcional de facturación y contabilidad para autónomos y pymes en España: presupuestos y facturas con PDF, gastos con IVA e IRPF, OCR de facturas recibidas, bancos con conciliación, varias empresas y estimación de los modelos 303, 111 y 349.

- **Demo:** https://emax-pruebatec.vercel.app/
- **Repositorio:** https://github.com/JosueMrals/emax-pruebatec

## 1. Cómo ejecutarlo

Requisitos: Node.js 20+ y una base PostgreSQL (se usó Supabase).

```bash
git clone https://github.com/JosueMrals/emax-pruebatec
cd emax-pruebatec
npm install                # ejecuta también prisma generate
cp .env.example .env.local # completar las variables
npx prisma migrate deploy
npx prisma db seed         # 2 empresas ficticias con contactos y cuenta bancaria
npm run dev
```

Variables de entorno:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión con pooler (Supabase, puerto 6543) usada por la app |
| `DIRECT_URL` | Conexión directa (puerto 5432) para migraciones y seed |
| `GEMINI_API_KEY` | OCR; solo se lee en el servidor (`app/api/ocr/route.ts`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente de Supabase (solo la página de ejemplo `/todos`) |

Tests:

```bash
npm test          # 48 tests unitarios: lógica fiscal, OCR, CSV bancario, conciliación, IBAN, filtros, numeración
npm run test:e2e  # circuito completo contra la base real, en una empresa temporal que se borra al terminar
```

`npm test` no usa base de datos ni servicios externos. `npm run test:e2e` ejecuta las Server Actions reales (configuración → contactos → presupuesto → factura → gasto → importación bancaria → conciliación → aislamiento entre empresas) y no toca los datos existentes.

## 2. Tecnologías utilizadas

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) + TypeScript |
| Base de datos | PostgreSQL en Supabase |
| ORM | Prisma 7 con `@prisma/adapter-pg` |
| UI | Tailwind CSS 4 + shadcn/ui |
| Validación | Zod 4 (formularios, Server Actions y respuesta del OCR) |
| PDF | `@react-pdf/renderer` 4.6.1, generado en el servidor (versiones fijadas, ver limitaciones) |
| OCR | Google Gemini (`gemini-3.8-flash`, nivel gratuito) con salida JSON según esquema, solo desde el servidor |
| Tests | `node:test` ejecutado con `tsx` |
| Despliegue | Vercel |
| Asistente de desarrollo | Claude Code |

**Persistencia:** PostgreSQL. Los datos se mantienen al recargar y entre dispositivos.

## 3. Arquitectura y decisiones

```
app/            páginas (dashboard, presupuestos, facturas, gastos, banco, contactos, impuestos,
                configuración), rutas PDF y /api/ocr
actions/        Server Actions por dominio: empresa, contactos, presupuestos, facturas, gastos, banco
components/     formularios, listados, filtros y plantillas PDF (components/pdf/)
lib/fiscal/     lógica fiscal pura: totales y desglose de IVA, IRPF, trimestres, modelos 303/111/349
lib/bank/       lectura de CSV bancarios y sugerencias de conciliación (puras)
lib/ocr/        esquema de extracción y validación cruzada de importes
lib/validation/ esquemas Zod compartidos por formularios y servidor
lib/company.ts  empresa activa (cookie) para páginas y acciones
lib/sales.ts    lógica común de presupuestos y facturas (cliente, totales, numeración)
prisma/         esquema, migraciones y seed
scripts/        prueba de extremo a extremo del circuito
```

- **Importes en céntimos enteros** para evitar errores de redondeo con decimales.
- **Lógica fiscal aislada** en funciones puras sin base de datos ni interfaz, cubierta por tests con los casos A, B y C.
- **El servidor recalcula siempre los totales.** Lo que muestra el formulario es solo una vista previa; nunca se confía en importes enviados por el cliente.
- **Operaciones intracomunitarias automáticas:** si el cliente es de otro país de la UE, la factura se marca como prestación de servicios intracomunitaria (inversión del sujeto pasivo, IVA 0 %) y se exige un NIF-IVA con el prefijo del país.
- **Numeración correlativa** por empresa, serie y año (`F-2026-0001`, `P-2026-0001`), generada dentro de una transacción. Las series se configuran por empresa.
- **Multiempresa:** `companyId` en todas las tablas y una cookie con la empresa activa. Todas las consultas y Server Actions filtran por la empresa activa y comprueban que cada id recibido (cliente, factura, movimiento…) le pertenece; un id de otra empresa se trata como inexistente. La prueba e2e lo verifica.
- **Configuración inicial:** si no existe ninguna empresa, cualquier página lleva a `/configuracion`, que crea la empresa y su cuenta bancaria principal.
- **Presupuestos con estados** (borrador → enviado → aceptado/rechazado → facturado). Solo un presupuesto aceptado se convierte en factura, una sola vez, y la factura se recalcula con las reglas fiscales actuales.
- **Banco y conciliación:** los extractos CSV de cualquier banco se leen detectando columnas (fecha, concepto, importe o cargo/abono), separador y formato de importe; reimportar el mismo extracto no duplica movimientos. La conciliación sugiere documentos con el mismo importe y prioriza los que el concepto menciona (número de factura o nombre del contacto) y la fecha más cercana. Conciliar un cobro marca la factura como cobrada en la fecha del banco; deshacerlo la devuelve a pendiente. Si un movimiento no tiene documento, «Crear factura/Registrar gasto con este importe» abre el formulario con la fecha, el concepto, el contacto que nombra el concepto y la base calculada para que el total con IVA (e IRPF) coincida exactamente con el banco; al guardar queda conciliado en la misma transacción y se vuelve a la conciliación.
- **PDF en el servidor** de facturas y presupuestos (emisor, cliente, líneas, desglose de IVA por tipo, mención de inversión del sujeto pasivo, IBAN de pago) y del resumen trimestral de impuestos, siempre de la empresa activa.
- **Filtros en la URL** (búsqueda, estado, tipo, trimestre) en presupuestos, facturas, gastos, banco y contactos: funcionan sin JavaScript y se pueden compartir.
- **Seguridad de la base:** RLS activado en todas las tablas sin políticas, para que la clave pública de Supabase no pueda leer datos; la app accede solo desde el servidor con Prisma.
- **OCR con validación:** se pide al modelo un JSON según un esquema generado desde Zod y la respuesta se vuelve a validar con Zod; se comprueba que base + IVA − IRPF = total (tolerancia de 2 céntimos), se infieren tipos de IVA e IRPF a partir de los importes y se muestran avisos antes de guardar. El usuario siempre revisa y edita.
- **Errores controlados:** mensajes claros en español para validación, duplicados, fallos del OCR y de la base, sin romper la página.

## 4. Funcionalidades implementadas

| Funcionalidad | Estado |
|---|---|
| Navegación y dashboard del trimestre (ingresos, gastos, balance, pendientes de cobro, saldo bancario, movimientos sin conciliar, presupuestos abiertos) | ✅ Funcional |
| Configuración inicial y datos de empresa (NIF, dirección, IBAN validado, series de numeración) | ✅ Funcional |
| Multiempresa con selector de empresa activa y datos aislados por empresa | ✅ Funcional |
| Presupuestos con estados, validez y conversión a factura | ✅ Funcional |
| Facturas emitidas: cliente existente o nuevo, varias líneas, IVA por línea, total, listado y cambio a cobrada | ✅ Funcional |
| Operaciones intracomunitarias de servicios con NIF-IVA | ✅ Funcional |
| Gastos y facturas recibidas con IVA, IRPF y marca de deducible | ✅ Funcional |
| OCR de PDF o imagen con extracción real, campos editables y validación de importes | ✅ Funcional |
| Estimación de los modelos 303, 111 y 349 por trimestre, con navegación entre trimestres | ✅ Funcional |
| Exportación PDF de facturas, presupuestos y resumen de impuestos | ✅ Funcional |
| Contactos: clientes y proveedores con datos completos, búsqueda, edición, historial y borrado seguro | ✅ Funcional |
| Filtros por búsqueda, estado, tipo y trimestre en todos los listados | ✅ Funcional |
| Banco: cuentas, saldo, importación de extractos CSV sin duplicados y alta manual | ✅ Funcional |
| Conciliación bancaria con sugerencias automáticas y opción de deshacer | ✅ Funcional |
| Persistencia en PostgreSQL | ✅ Funcional |
| Autenticación de usuarios y permisos | ⏳ No implementado |

**Casos de prueba:** (para el caso D se incluye `factura-ejemplo-ocr.png`, una factura ficticia que reproduce el caso B)

| Caso | Resultado |
|---|---|
| A — Factura a Empresa Demo SL, 1.000 € + 21 % | Total 1.210 €; suma 210 € al IVA repercutido del 303 |
| B — Gasto 1.000 €, IVA 21 %, IRPF 15 % | Total 1.060 €; 210 € de IVA soportado y 150 € en el 111 |
| C — Servicio a Beispiel Software GmbH (Alemania), 2.000 € | IVA 0 %; aparece en el 349 con su NIF-IVA y clave S |
| D — OCR | El archivo se procesa, los campos se rellenan, son editables y se guarda como gasto |
| E — Persistencia | Tras recargar, los registros y resúmenes se mantienen coherentes |

**Recorrido de demostración (circuito completo):**

1. **Configuración** → crea tu empresa (o usa «Mi empresa» del seed) y, si quieres, otra con «Añadir otra empresa»; cambia entre ellas con el selector de la cabecera.
2. **Contactos** → da de alta un cliente con sus datos completos.
3. **Presupuestos** → crea un presupuesto, márcalo como enviado y aceptado, y pulsa «Facturar».
4. **Facturas** → la factura aparece numerada; descarga su PDF.
5. **Gastos** → registra un gasto (a mano o con OCR).
6. **Banco** → importa un extracto CSV con el cobro y el pago (columnas `Fecha;Concepto;Importe`).
7. **Conciliación** → acepta las sugerencias: la factura pasa a cobrada y el gasto a pagado. Para un movimiento sin documento, «Crear factura con este importe» abre la factura ya rellenada y la concilia al guardar.
8. **Dashboard e Impuestos** → saldo, pendientes y modelos actualizados; descarga el PDF del trimestre.

**Limitaciones conocidas:**
- No hay autenticación: la empresa activa se elige con un selector y cualquiera con acceso a la URL puede ver y cambiar a todas las empresas. Los datos están aislados entre empresas, pero no protegidos por usuario.
- La conciliación solo admite pagos exactos (un movimiento ↔ un documento); no hay pagos parciales ni agrupados.
- Los proveedores solo pueden ser españoles: los gastos de otros países de la UE requieren autoliquidar el IVA, que no está contemplado.
- No hay conexión directa con bancos: los movimientos entran por CSV o a mano.
- `@react-pdf/renderer` está fijado en 4.6.1 (con `overrides` de `@react-pdf/render` 4.6.1 y `@react-pdf/textkit` 6.4.1): las versiones nuevas dependen de `@react-pdf/hyphenate` 0.1.0, que no se puede cargar con `require` de Node y rompe el PDF en el servidor.
- El 349 solo contempla prestaciones de servicios (clave S); no hay entregas de bienes ni adquisiciones intracomunitarias.
- El NIF-IVA se valida por formato, sin consultar VIES.
- Las facturas no se pueden editar ni rectificar todavía.
- El OCR usa el nivel gratuito de Gemini, que puede usar el contenido enviado para mejorar sus productos; por eso la interfaz pide no subir facturas reales. En producción se usaría un plan de pago con garantías de privacidad.
- Los modelos son estimaciones, no declaraciones oficiales.

## 5. Tiempo invertido

- Preparación del entorno (repo, Supabase, deploy vacío en Vercel, instrucciones para el asistente): 30 min
- Desarrollo: 1 hora 50 min
- Documentación: 20 min

## 7. Preguntas finales

### Arquitectura: uso diario por miles de empresas

- **Multiempresa real:** el prototipo ya tiene `companyId` en todas las tablas y filtra cada consulta por empresa; faltaría autenticación con roles por empresa y políticas de Row Level Security en PostgreSQL para que el aislamiento no dependa solo del código de la aplicación.
- **Rendimiento:** índices compuestos por empresa y fecha; resúmenes de dashboard e impuestos calculados de forma incremental o cacheados por trimestre.
- **Procesos en segundo plano:** el OCR y las futuras integraciones con la Agencia Tributaria en una cola de trabajos con reintentos, para que la interfaz no espere.
- **Seguridad y cumplimiento:** registro de auditoría, facturas inmutables (las correcciones van por rectificativas), copias de seguridad, cifrado de documentos y cumplimiento del RGPD.
- **Escalabilidad:** documentos en almacenamiento de objetos, pool de conexiones y límites de uso por empresa en el OCR.

### Automatización: mejorar el OCR

- **Validación cruzada ampliada:** además de base + IVA − IRPF = total, comprobar el dígito de control del NIF, fechas plausibles y facturas duplicadas por proveedor y número.
- **Memoria por proveedor:** reconocer al proveedor por su NIF y aprender de las correcciones del usuario para sus siguientes facturas.
- **Nivel de confianza:** guardar automáticamente solo las extracciones que pasan todas las validaciones; el resto, a una bandeja de revisión.
- **Entrada automática:** recibir facturas por un correo dedicado o por carpeta compartida y procesarlas sin intervención.

### Visión de producto: tres mejoras prioritarias

1. **Cumplimiento VERI\*FACTU y envío a la Agencia Tributaria.** Es obligatorio para emitir facturas en España: sin esto el producto no puede venderse.
2. **Conexión bancaria y conciliación automática.** Elimina la tarea más repetitiva y es lo que más valor percibe un autónomo.
3. **Asistente fiscal con IA.** Avisos de plazos, explicación de cada modelo en lenguaje sencillo y alertas de gastos no deducibles, como diferencia frente a la competencia.