# SCRAM - Sistema de Gestión Logística

Sistema de gestión logística de última milla que conecta el ERP Bind con operaciones de entrega. Monorepo fullstack con API, portal web, PWA móvil y worker de jobs asíncronos.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| API | NestJS 10, TypeORM 0.3, PostgreSQL 16 + PostGIS |
| Autenticación | JWT + Argon2 |
| Cola de jobs | BullMQ + Redis 7 |
| Frontend web | Next.js 14, React 18, MUI v5, Zustand, TanStack Query |
| Mobile/PWA | Vite 5, React 18, Dexie (IndexedDB), vite-plugin-pwa |
| Mapas | Leaflet, Google Maps API, Google Routes API |
| Email | SendGrid API |
| Storage | Google Cloud Storage |
| Reverse proxy | Traefik (HTTPS con Let's Encrypt) |
| Contenedores | Docker, Docker Compose |

---

## Estructura del monorepo

```
├── backend/                 # API NestJS + Worker BullMQ
│   ├── src/
│   │   ├── common/          # Enums, servicios compartidos (geocoding, routes)
│   │   ├── config/          # Configuración centralizada y TypeORM
│   │   ├── migrations/      # 11 migraciones de base de datos
│   │   ├── modules/
│   │   │   ├── auth/        # Login, JWT, password reset
│   │   │   ├── orders/      # Órdenes, evidencias, address change requests
│   │   │   ├── routes/      # Planificación y optimización de rutas
│   │   │   ├── sync/        # Integración Bind ERP
│   │   │   ├── clients/     # Datos maestros de clientes
│   │   │   ├── client-addresses/  # Direcciones geocodificadas
│   │   │   ├── storage/     # Google Cloud Storage
│   │   │   ├── webhooks/    # Receptor de webhooks Bind
│   │   │   ├── push-subscriptions/ # Web push notifications
│   │   │   └── health/      # Health checks
│   │   └── worker/
│   │       ├── main.ts      # Bootstrap del worker (proceso separado)
│   │       ├── processors/  # email.processor.ts
│   │       └── services/    # email.service.ts (SendGrid)
│   ├── Dockerfile           # Build de la API
│   └── Dockerfile.worker    # Build del worker
├── frontend/                # Portal web Next.js
│   └── src/
│       ├── app/
│       │   ├── dashboard/   # KPIs ejecutivos
│       │   ├── compras/     # Sync Bind, gestión de borradores
│       │   ├── planning/    # Mapa, asignación, dispatch
│       │   ├── ventas/      # Búsqueda y tracking de órdenes
│       │   ├── clientes/    # Gestión de clientes
│       │   ├── usuarios/    # Gestión de usuarios
│       │   ├── track/       # Tracking público (sin auth)
│       │   └── survey/      # Encuesta CSAT pública
│       ├── components/      # OrdersMap, RouteOptimizationDialog
│       ├── lib/api.ts       # Cliente Axios + endpoints
│       └── store/           # Zustand (orders.store.ts)
├── mobile/                  # PWA para conductores
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx    # Autenticación
│       │   ├── Route.tsx    # Manifiesto de ruta del conductor
│       │   └── Delivery.tsx # Captura de evidencia (foto + firma)
│       ├── hooks/useSync.ts # Sincronización offline-first
│       ├── lib/db.ts        # Dexie (IndexedDB)
│       └── lib/push.ts      # Web Push API
├── scripts/                 # Utilidades de BD y deploy
├── docker-compose.yml       # Orquestación de producción
└── docker-compose.override.yml # Overrides para desarrollo local
```

---

## Dominio de negocio

### Flujo principal

```
Bind ERP ──sync──► DRAFT ──release──► READY ──dispatch──► IN_TRANSIT ──deliver──► DELIVERED
                     │                   │                    │                      │
                 Compras             Compras              Tráfico              Conductor
                 revisa              libera               asigna +              captura
                 y edita                                  optimiza              foto + firma
```

### Funcionalidades (Requerimientos Funcionales)

| RF | Descripción |
|---|---|
| RF-01 | **Sincronización de órdenes** - Importa desde Bind ERP (diferencial, idempotente). Fallback: carga Excel manual. |
| RF-02 | **Priorización inteligente** - CRITICAL (vencido/VIP), HIGH (>$50k MXN), NORMAL. |
| RF-03 | **Gestión de flota** - Asignación drag-and-drop, validación de capacidad (max 15/conductor), carriers externos. |
| RF-04 | **Manifiesto digital y POD** - PWA offline: pickup → en ruta → foto + firma → entregado. |
| RF-05 | **Satisfacción del cliente** - Encuesta CSAT (1-5 estrellas), alerta por detractores (≤2). |

### Roles de usuario

| Rol | Acceso |
|---|---|
| `ADMIN` | Acceso total, gestión de usuarios |
| `PURCHASING` | Sync Bind, revisión/liberación de órdenes, CRUD de direcciones |
| `DRIVER` | PWA móvil, manifiesto de ruta, captura de evidencias |
| `SALES` | Consulta de órdenes, tracking de estado |
| `DIRECTOR` | Dashboard ejecutivo, KPIs, métricas |

---

## Base de datos

### Entidades principales

```
User
  ├── assignedOrders: Order[]
  └── pickupConfirmedByUser: Order[]

Order (DRAFT → READY → IN_TRANSIT → DELIVERED)
  ├── assignedDriver: User
  ├── client: Client
  ├── deliveryAddress: ClientAddress
  └── evidences: ShipmentEvidence[]

Client
  ├── addresses: ClientAddress[]
  └── orders: Order[]

ShipmentEvidence (PHOTO | SIGNATURE)
  └── order: Order
```

### Índices optimizados

- `idx_orders_dashboard` - Status + priority (vistas de dashboard)
- `idx_orders_bind_id` - Lookup rápido para sync
- `idx_orders_geo` - GIST spatial (consultas geográficas)
- `idx_tracking_active` - Parcial en tracking_hash WHERE IN_TRANSIT

---

## Backend - API

### Módulos

| Módulo | Endpoints clave |
|---|---|
| `auth` | `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| `orders` | `GET /orders`, `POST /orders/dispatch`, `PATCH /orders/:id/deliver`, `POST /orders/assign`, `POST /orders/release` |
| `sync` | `POST /sync` (trigger sync manual desde Bind) |
| `routes` | Optimización de rutas con Google Routes API |
| `clients` | `GET /clients`, datos maestros |
| `client-addresses` | CRUD de direcciones, geocodificación automática |
| `storage` | Upload de evidencias a GCS |
| `webhooks` | Receptor de invoices desde Bind |

### Worker (proceso separado)

Consume la cola `notifications` de BullMQ:

| Job | Trigger |
|---|---|
| `send-eta-email` | Al despachar ruta |
| `send-en-route-email` | Conductor marca "en camino" |
| `send-delivery-confirmation` | Orden entregada (incluye link a encuesta CSAT) |
| `send-detractor-alert` | CSAT ≤ 2 estrellas |
| `send-password-reset` | Solicitud de reset |
| `send-carrier-shipment` | Notificación a carrier externo |

---

## Frontend - Portal web

| Página | Rol | Descripción |
|---|---|---|
| `/dashboard` | Director | KPIs: entregas, ingresos, CSAT. Gráficos por status, prioridad, conductor. |
| `/compras` | Compras | 3 tabs: Pendientes (DRAFT), Liberados (READY), Activos (IN_TRANSIT/DELIVERED). Sync Bind, edición de direcciones. |
| `/planning` | Tráfico | Mapa Leaflet con pines de órdenes. Asignación a conductores, optimización Google Routes, dispatch. |
| `/ventas` | Ventas | Búsqueda de órdenes, stepper de estado, detalle. |
| `/clientes` | Admin | Gestión de datos maestros de clientes. |
| `/usuarios` | Admin | ABM de usuarios y roles. |
| `/track/[hash]` | Público | Tracking en tiempo real (sin auth). |
| `/survey/[hash]` | Público | Encuesta CSAT post-entrega. |

### State management

- **Zustand** para estado local (órdenes seleccionadas en planning)
- **TanStack Query** para cache y fetching de datos del servidor
- **Axios** con interceptores JWT (auto-logout en 401)

---

## Mobile - PWA offline-first

### Arquitectura offline

- **Dexie (IndexedDB)** con 4 tablas: `orders`, `evidence`, `pendingSync`, `session`
- **useSync hook** - Detecta conectividad, sincroniza automáticamente, reintentos con backoff
- **Service Worker** - Cache-first para assets, network-first para API
- **APP_DATA_VERSION** - Fuerza limpieza de IndexedDB al actualizar la app

### Flujo del conductor

1. **Login** → Token JWT almacenado en IndexedDB
2. **Manifiesto de ruta** → Lista de órdenes asignadas
3. **Confirmar pickup** → Timestamp + ubicación GPS
4. **Marcar "en ruta"** → Notifica al cliente por email
5. **Captura de evidencia** → Foto (cámara/galería) + firma (canvas táctil)
6. **Marcar entregado** → Sincroniza cuando hay conexión

---

## Infraestructura

### Docker Compose (producción)

| Servicio | Imagen | Puerto |
|---|---|---|
| `db` | postgis/postgis:16-3.4-alpine | 5434 |
| `redis` | redis:7-alpine | 6381 |
| `api` | scram-logistica-api:prod | 3000 → Traefik |
| `worker` | scram-logistica-worker:prod | interno |
| `web` | scram-logistica-web:prod | 3000 → Traefik |
| `mobile` | scram-logistica-mobile:prod | 80 → Traefik |

### Dominios

- API: `api-gestion-logistica.scram2k.com`
- Web: `gestion-logistica.scram2k.com`
- Mobile: `app-gestion-logistica.scram2k.com`

### Variables de entorno clave

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@db:5432/scram

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=<min 32 caracteres>

# Bind ERP
BIND_API_URL=https://app.bind.com.mx/api/external/v1
BIND_API_KEY=<api_key>

# Email
SENDGRID_API_KEY=<key>
EMAIL_FROM=no-reply@scram2k.com

# Google
GOOGLE_MAPS_API_KEY=<key>
GCS_PROJECT_ID=<project>
GCS_BUCKET_NAME=<bucket>
GCS_KEY_FILE=<path>

# Negocio
PRIORITY_THRESHOLD_AMOUNT=50000
MAX_ORDERS_PER_DRIVER=15
DEFAULT_ROUTE_START_TIME=08:00
AVERAGE_STOP_TIME_MINUTES=15
TRAFFIC_BUFFER_PERCENT=20
```

---

## Migraciones de base de datos

| # | Migración | Descripción |
|---|---|---|
| 1 | InitialSchema | Users, orders, shipment_evidence |
| 2 | SeedUsers | Usuarios de ejemplo |
| 3 | AddOrderFieldsAndDismissedInvoices | Tracking de invoices Bind |
| 4 | AddClientAddresses | Tabla de direcciones |
| 5 | AddClients | Datos maestros de clientes |
| 6 | AddBindClientIdToOrders | Vinculación con cliente Bind |
| 7 | AddAddressChangeRequests | Workflow de cambio de dirección |
| 8 | AddPushSubscriptions | Endpoints de web push |
| 9 | AddPickupConfirmationFields | Confirmación de pickup |
| 10 | AddPasswordResetFields | Tokens de reset |
| 11 | AddOrderStatusValues | Expansión de enum de status |
