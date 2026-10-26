AvoChain - Trazabilidad de Aguacate
Sistema de trazabilidad para la cadena de suministro de aguacate Hass utilizando una arquitectura basada en blockchain simulado y patron Controller-Service-Repository.

Requerimientos Funcionales e Historias de Usuario
HU-01, HU-02, HU-06 (Modulo Productor): Registro de fincas con datos ICA/GPS, creacion de lotes de cosecha y carga de evidencias fotograficas.

HU-07, HU-08 (Modulo Bodega): Generacion de codigos QR para rotulado de lotes y asignacion de conductores para despacho.

HU-03, HU-09 (Modulo Conductor): Escaneo de lotes en recepcion y registro de incidentes o novedades en ruta.

HU-04, HU-05 (Modulo Tienda y Cliente): Consulta del historial de origen del producto mediante codigo de lote y registro de venta final.

HU-10 (Modulo Administrador): Visualizacion de metricas generales en dashboard y edicion o eliminacion de bloques/lotes registrados.

HU-11 (Modulo Calidad): Inspeccion pre-despacho, medicion de humedad y temperatura, informe PDF y transición a Aprobado_Calidad o Rechazado_En_Origen.

HU-12 (Modulo Destino): Confirmacion de recepción en punto de venta con temperatura, cajas dañadas, alerta de excursión térmica y registro simulado en blockchain.

El conductor puede registrar sucesos de ruta (camión varado, choque, trancón por vías cerradas, vía cerrada, derrumbe, falla mecánica, clima adverso u otro). Cada reporte se conserva en `incidentesRuta` y en el historial `eventos` del lote en MongoDB.
La recepción final se confirma desde la vista del conductor con temperatura de llegada, cajas dañadas y temperatura máxima de ruta opcional. Los sucesos reportados requieren coordenadas; la interfaz permite capturar GPS del navegador o ingresarlas manualmente.

El panel de administración muestra las fincas y lotes registrados y permite abrir el detalle de cada lote: inspección, QR, despacho, recepción, evidencias, incidentes, último GPS reportado e historial. El GPS es el último dato enviado por el conductor, no rastreo en vivo.

Arquitectura y Tecnologias
Lenguaje: TypeScript / JavaScript (Node.js)

Frontend: HTML5, CSS (Tailwind CSS via CDN), Vanilla JavaScript

Patrones de Diseno: Controller-Service-Repository, Singleton (Generador QR), Adapter (Blockchain)

HU-11 aplica una estrategia de evaluación según destino. HU-12 encadena validaciones de rol, estado y mediciones antes de registrar la recepción. La conexión blockchain sigue siendo simulada.

MongoDB: `docker compose up -d mongo` levanta la base en `127.0.0.1:27018`. Copia `.env.example` a `.env` si necesitas cambiar la conexión del backend; al iniciar, el servidor espera a que MongoDB conecte y persiste fincas y lotes en `usuarios`, `fincas` y `lotes`, con documentos en la estructura de dominio y referencias BSON `ObjectId`. La base inicia vacía y no se insertan registros de demostración automáticamente. Configura `MONGO_ROOT_USERNAME` y `MONGO_ROOT_PASSWORD` antes de recrear el contenedor si vas a cambiar las credenciales. El anclaje blockchain continúa simulado; los hashes guardados en Mongo son los retornados por ese adaptador simulado. Las URLs de informes PDF se reciben como referencia; la carga real a S3 y la autenticación JWT requieren sus adaptadores/servicios.

Endpoints nuevos:

- `GET /api/v1/fincas` — devuelve las fincas persistidas para cargar el selector al abrir la interfaz.
- `GET /api/v1/admin/lotes/:idLote` — devuelve el detalle administrativo del lote, incluso si está vendido.
- `POST /api/v1/lotes/:idLote/inspeccion-calidad` — `{ rol, inspectorId, destino, humedad, temperaturaC, evaluacionFitosanitaria, informePdfMimeType: "application/pdf", informePdfUrl, informePdfSizeBytes }`.
- `POST /api/v1/lotes/:idLote/recepcion-destino` — `{ rol, receptorId, temperaturaC, cajasDanadas, temperaturaMaximaRutaC? }`.

Requisitos Previos
Node.js (version 18 o superior)

npm (gestor de paquetes de Node)

Instalacion y Ejecucion
Clonar el repositorio:

Bash
git clone https://github.com/TU-USUARIO/avochain-trazabilidad.git
Navegar al directorio del proyecto:

Bash
cd avochain-trazabilidad
Instalar las dependencias:

Bash
npm install
Iniciar la base de datos con Docker y, en otra terminal, el servidor de desarrollo:

Bash
docker compose up -d mongo
npm run dev
Abrir el navegador e ingresar a:

Plaintext
http://localhost:3001

Para ejecutar una versión compilada usa `npm run build` y después `npm start`.

### Beta gratuita y Wompi Premium

La interfaz es una aplicación web servida por Express; se usa desde el navegador en escritorio. Los nombres, descripciones y equivalencias de los siete roles están centralizados en `src/domain/roles/Roles.ts`.

Se agregaron dos funcionalidades Premium protegidas en el backend:

- **Administración y reporte global:** totales de fincas, lotes, viajes, transportadores, kilos e incidentes, además del detalle por finca y estado.
- **Exportación de trazabilidad:** descarga el historial cronológico y hashes de un lote en CSV.

La **beta** permite usar los flujos operativos habituales sin pagar. Administración, reportes globales y exportación de trazabilidad requieren Premium incluso durante la beta. El plan **Premium** corresponde a una compra aprobada por Wompi o a la pasarela demostrativa, y conserva el acceso después de desactivar la beta. El estado del plan se muestra al consultar el correo.

La interfaz también incluye una **pasarela de demostración** separada. El botón “Demostración de pago” abre una pantalla propia que no solicita tarjeta ni realiza cobros; al confirmar, guarda en MongoDB una orden `APPROVED` con referencia `DEMO-` e identificador `SIMULADO-`, y activa Administración y Premium para ese correo. Está habilitada con `PAYMENT_DEMO_ENABLED=true` y se puede ocultar/desactivar con `PAYMENT_DEMO_ENABLED=false`. Esta simulación no reemplaza la integración real de Wompi.

Para configurar el checkout de **Wompi Sandbox**, copia `.env.example` como `.env` y completa `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET` con las llaves de prueba del comercio Wompi. El precio se configura en `PREMIUM_PRICE_COP` (COP), y `WOMPI_ENVIRONMENT=sandbox` debe mantenerse para pruebas. No publiques ni compartas los secretos. Reinicia `npm run dev` tras editar `.env`. Sin `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` y precio válido, el estado del plan indicará que el checkout no está configurado y el botón de pago quedará desactivado.

Si pruebas desde un túnel o dominio público, configura `APP_BASE_URL` con esa URL HTTPS antes de iniciar el backend, para que el retorno de Wompi vuelva al sitio correcto. Configura en el Dashboard de Wompi el webhook sandbox apuntando a `/api/v1/pagos/wompi/webhook`.

La aplicación crea la referencia y la firma de integridad en el backend, abre el checkout de Wompi y solo activa Premium cuando verifica una transacción aprobada con el mismo valor, moneda y referencia. El regreso del checkout se verifica desde el servidor consultando la API de Wompi; el webhook `POST /api/v1/pagos/wompi/webhook` también valida el checksum de eventos. Para que Wompi pueda enviar webhooks durante desarrollo local, configura una URL HTTPS pública temporal (por ejemplo, un túnel) que apunte a ese endpoint; en producción usa el dominio HTTPS de la aplicación.

**Alcance de esta entrega:** el prototipo vincula el pago a un correo escrito por el usuario porque el proyecto todavía no tiene registro, inicio de sesión ni autenticación de cuentas. Antes de cobrar a usuarios reales hay que agregar autenticación y asociar el correo verificado al usuario autenticado. La selección visual de roles existente también sigue siendo demostrativa; esta entrega centraliza los nombres/roles, no convierte esa selección en autenticación.
### Diagramas para la entrega

Los diagramas de clases, paquetes, datos y casos de uso están en [`docs/diagramas.md`](docs/diagramas.md), con cada fuente Mermaid disponible por separado en `docs/diagramas/`.

### Estructura del proyecto

```text
public/                         # Aplicación web HTML/CSS/JavaScript
src/
├── application/                # Servicios de negocio y DTOs
├── domain/                     # Entidades, roles, estados y reglas
├── infrastructure/             # MongoDB, Wompi, blockchain simulado, almacenamiento
└── presentation/               # Controladores REST
mongo/                          # Inicialización y consultas de MongoDB
docs/diagramas.md               # Diagramas para la entrega académica
docker-compose.yml              # MongoDB local
```
