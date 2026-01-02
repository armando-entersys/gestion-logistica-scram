# **ESPECIFICACIÓN TÉCNICA: ESTRUCTURA DE DISEÑO TÉCNICO (MD070)**

**Proyecto:** Sistema de Gestión Logística SCRAM

**Tipo de Documento:** Diseño Técnico (Technical Design)

**Versión:** 6.0 (Master Architecture \- EnterSys Infrastructure)

**Fecha:** 02/01/2026

**Autor:** Lead Software Architect

## **1\. INTRODUCCIÓN**

### **1.1 Propósito**

El propósito fundamental de este documento es definir la solución técnica integral para el sistema SCRAM, traduciendo los requerimientos funcionales aprobados (MD050 v3.4) en especificaciones técnicas detalladas y ejecutables. Este documento sirve como contrato técnico entre Arquitectura y el equipo de Desarrollo/DevOps. Describe no solo "qué" se va a construir, sino **"cómo"** se implementará internamente, garantizando que el software resultante sea resiliente (Offline-First), escalable verticalmente en el servidor prod-server y seguro.

Ejemplo: "Este documento detalla la arquitectura de microservicios lógicos sobre un monolito modular, la persistencia en PostgreSQL con PostGIS, la estrategia de colas con Redis para notificaciones asíncronas y la implementación de una PWA con almacenamiento local IndexedDB."

### **1.2 Alcance**

Esta sección delimita las fronteras técnicas del desarrollo dentro del ecosistema EnterSys.

* **Nuevos Módulos:**  
  * **Backend API (NestJS):** Núcleo de lógica de negocio, autenticación y orquestación.  
  * **Frontend Web (Next.js):** Panel administrativo para roles de Compras, Tráfico y Ventas.  
  * **Frontend Móvil (PWA \- Vite):** Aplicación para choferes con capacidad Offline-First.  
  * **Worker Service:** Procesador de segundo plano para tareas pesadas (Emails, ETA).  
* **Modificaciones a Módulos Existentes:** N/A (Desarrollo Green-field).  
* **Integraciones:**  
  * **Bind ERP:** Consumo de API REST para sincronización unidireccional de pedidos.  
  * **Google Maps Platform:** Geocodificación y Matriz de Distancia.  
  * **SendGrid:** Envío transaccional de correos.  
* **Base de Datos:**  
  * Creación de esquema relacional scram\_db en PostgreSQL 16\.  
  * Implementación de extensión PostGIS para consultas espaciales.  
* **Infraestructura:**  
  * Despliegue en servidor prod-server (GCP e2-standard-2) usando Docker Compose.  
  * Integración con Traefik Reverse Proxy existente.

### **1.3 Referencias**

* **MD050 \- Diseño Funcional (v3.4):** Reglas de negocio y flujos.  
* **Guía de Infraestructura EnterSys:** Restricciones de puertos, red traefik-public y gestión de recursos.  
* **Estándares de Codificación:** TypeScript Strict Mode, ESLint (Airbnb config), Prettier.  
* **Arquitectura:** Modelo C4 (Contenedores y Componentes).

## **2\. ARQUITECTURA DE DATOS (DATA DESIGN)**

Esta sección es crítica para la persistencia e integridad. Se utiliza PostgreSQL 16 como motor principal debido a su robustez transaccional y soporte JSONB/GIS.

### **2.1 Modelo de Datos (ERD Físico)**

Tabla: orders (Pedidos)  
Propósito: Almacenar el ciclo de vida central del envío.

| Columna | Tipo de Dato | Nulo | PK/FK | Descripción/Comentario |
| :---- | :---- | :---- | :---- | :---- |
| id | UUID | No | PK | gen\_random\_uuid(). Identificador interno inmutable. |
| bind\_id | VARCHAR(50) | No | UK | ID externo del ERP. Llave de idempotencia para sincronización. |
| client\_email | VARCHAR(150) | No | \- | Contacto principal para notificaciones ETA. |
| address\_geo | GEOGRAPHY(Point, 4326\) | Si | Index | Coordenada normalizada. Índice GIST para búsquedas espaciales. |
| address\_raw | JSONB | No | \- | Objeto completo {calle, num, col, cp, ciudad} para visualización. |
| status | VARCHAR(20) | No | \- | Máquina de estados: DRAFT, READY, IN\_TRANSIT, DELIVERED. |
| priority\_level | SMALLINT | No | \- | 1=Normal, 2=Alta ($), 3=Crítica (Urgente/VIP). Default: 1\. |
| tracking\_hash | VARCHAR(64) | Si | UK | Token HMAC para URL pública de rastreo. Indexado. |
| assigned\_driver\_id | UUID | Si | FK | Referencia a users.id. |
| created\_at | TIMESTAMP | No | \- | Default NOW(). |

Tabla: shipment\_evidence (Evidencia de Entrega)  
Propósito: Almacenar pruebas legales de la entrega (POD).

| Columna | Tipo de Dato | Nulo | PK/FK | Descripción/Comentario |
| :---- | :---- | :---- | :---- | :---- |
| id | UUID | No | PK | Identificador único. |
| order\_id | UUID | No | FK | Relación con el pedido. |
| type | VARCHAR(20) | No | \- | CHECK (type IN ('PHOTO', 'SIGNATURE')). |
| storage\_key | VARCHAR(255) | No | \- | Ruta relativa en S3/MinIO. **NO guardar BLOB en DB**. |
| is\_offline\_upload | BOOLEAN | No | \- | Default FALSE. Auditoría de sincronización tardía. |

Tabla: users (Usuarios y Roles)  
Propósito: Gestión de identidad y RBAC.

| Columna | Tipo de Dato | Nulo | PK/FK | Descripción/Comentario |
| :---- | :---- | :---- | :---- | :---- |
| id | UUID | No | PK | Identificador. |
| email | VARCHAR(100) | No | UK | Credencial de acceso. Indexado. |
| password\_hash | VARCHAR(255) | No | \- | Hash Argon2id. |
| role\_code | VARCHAR(20) | No | \- | CHECK IN ('ADMIN', 'PURCHASING', 'DRIVER', 'SALES'). |

### **2.2 Objetos de Base de Datos Adicionales**

* **Índices de Rendimiento:**  
  * idx\_orders\_dashboard: CREATE INDEX ON orders (status, priority\_level DESC) \-\> Optimiza la vista principal de Tráfico ("Cockpit").  
  * idx\_orders\_geo: CREATE INDEX ON orders USING GIST (address\_geo) \-\> Búsquedas "Cerca de mí".  
  * idx\_tracking\_active: CREATE INDEX ON orders (tracking\_hash) WHERE status \= 'IN\_TRANSIT' \-\> Optimización para rastreo público.  
* **Secuencias:** No aplica (Uso de UUID v4).

## **3\. DISEÑO DE MÓDULOS / LÓGICA DE PROGRAMACIÓN**

Especificación de bajo nivel para los desarrolladores. Define la estructura interna del código en el Monolito Modular NestJS.

### **3.1 Estructura del Código y Patrones (Backend)**

* **Arquitectura:** Modular Monolith (Domain Driven Design Lite).  
* **Ubicación:** src/modules/{domain} (ej. src/modules/logistics).  
* **Tecnología:** Node.js 20 (Alpine), NestJS 10, TypeORM.  
* **Patrones:**  
  * **Repository:** Abstracción de acceso a datos.  
  * **Adapter:** BindSyncAdapter para aislar la lógica de integración externa.  
  * **Queue-Based Load Leveling:** Uso de BullMQ (Redis) para tareas pesadas, evitando bloqueo del Event Loop.

### **3.2 Lógica de Cliente Móvil (PWA Offline-First)**

Dado que los choferes operan en zonas sin señal, la PWA no debe depender de fetch directo para operaciones críticas.

* **Almacenamiento Local:** Uso de **Dexie.js** (IndexedDB Wrapper).  
  * Store manifests: Rutas descargadas.  
  * Store pending\_sync: Cola de peticiones fallidas (Command Pattern).  
* **Algoritmo de Sincronización:**  
  1. Chofer marca "Entregado" \-\> Se guarda en Dexie \-\> UI actualiza (Optimistic UI).  
  2. ServiceWorker detecta evento sync o cambio en navigator.onLine.  
  3. Itera sobre pending\_sync y envía POST al endpoint /sync.  
  4. **Si éxito:** Elimina de Dexie. **Si error 4xx:** Marca como "Conflicto" para revisión humana.

### **3.3 Especificación de Métodos Clave**

**Método:** ETA\_Calculator.compute(routePoints, departureTime)

* **Descripción:** Calcula ventanas de tiempo de llegada precisas.  
* **Lógica:**  
  1. Invocar **Google Maps Distance Matrix API** para obtener duration\_in\_traffic real entre puntos secuenciales.  
  2. Sumar TIEMPO\_SERVICIO configurable (Default: 15 min por parada para descarga).  
  3. Calcular Arrival\_Window \= (Hora\_Llegada\_Estimada \- 15min) a (Hora\_Llegada\_Estimada \+ 15min).  
  4. **Manejo de Errores:** Si Google API falla, usar distancia Haversine \* factor de tráfico promedio (fallback).

## **4\. INTEGRACIONES E INTERFACES**

Definición de contratos para la comunicación entre sistemas.

### **4.1 Mapeo de Interfaz: Bind ERP \-\> SCRAM (Sync)**

Transformación de datos (Anti-Corruption Layer).

| Campo Origen (Bind JSON) | Tipo | Regla de Transformación | Campo Destino (DB) |
| :---- | :---- | :---- | :---- |
| ID | GUID | Directo. Llave de idempotencia. | bind\_id |
| ClientName | String | Trim y Uppercase. | client\_name |
| Address Object | JSON | Concatenación y limpieza. | address\_raw |
| ProductList | Array | Sumatoria de importes totales. | total\_amount |
| Observations | String | Regex para buscar "VIP" o "URGENTE". | priority\_level |

### **4.2 Protocolo de Comunicación y Seguridad**

* **API REST:** Comunicación síncrona Frontend \<-\> Backend.  
  * **Seguridad:** JWT en Header Authorization: Bearer \<token\>.  
  * **Resiliencia:** Rate Limiting por IP (50 req/min) usando ThrottlerGuard de NestJS.  
* **Redis Pub/Sub:** Comunicación asíncrona Backend \<-\> Worker.  
  * **Cola:** scram\_notifications.  
  * **Payload:** { order\_id: UUID, type: 'ETA\_EMAIL', context: JSON }.

## **5\. ESTRATEGIA DE INSTALACIÓN Y DESPLIEGUE (DEPLOYMENT)**

Alineada estrictamente a la **Guía de Infraestructura EnterSys** (GUIA-DESPLIEGUE-NUEVAS-APPS.md).

### **5.1 Dependencias y Prerrequisitos**

* **Servidor:** prod-server (Debian 12).  
* **Motor:** Docker 28.3.2 \+ Docker Compose v2.  
* **Red:** Existencia de red externa traefik-public (Verificada).  
* **Puertos Host Asignados (Libres según guía):**  
  * PostgreSQL: 5434 (Evita conflicto con 5432/5433).  
  * Redis: 6381 (Evita conflicto con 6379/6380).  
  * API/Web: Sin exposición directa (vía Traefik).

### **5.2 Configuración de Contenedores (Docker Compose)**

Los contenedores operarán bajo estrategia de **"Burstable Performance"** (sin límites duros de CPU/RAM) para maximizar el uso del hardware disponible (Escalamiento Vertical).

**Archivo: docker-compose.yml (Extracto Clave)**

services:  
  api:  
    image: scram-api:prod  
    restart: unless-stopped  
    environment:  
      \- DATABASE\_URL=postgres://user:${DB\_PASS}@db:5432/scram  
      \- REDIS\_URL=redis://redis:6379  
    labels: \# Configuración Traefik Requerida  
      \- "traefik.enable=true"  
      \- "traefik.http.routers.scram-api.rule=Host(\`api-scram.entersys.mx\`)"  
      \- "traefik.http.routers.scram-api.entrypoints=websecure"  
      \- "traefik.http.routers.scram-api.tls.certresolver=letsencrypt"  
    networks: \[traefik-public, internal\]  
    healthcheck:  
      test: \["CMD", "wget", "--spider", "-q", "http://localhost:3000/health/liveness"\]  
      interval: 30s  
      retries: 3

  db:  
    image: postgres:16-alpine  
    volumes: \[pg\_data:/var/lib/postgresql/data\]  
    networks: \[internal\]  
    ports: \["127.0.0.1:5434:5432"\] \# Solo localhost para seguridad

networks:  
  traefik-public:  
    external: true  
  internal:  
    driver: bridge

### **5.3 Orden de Ejecución (Runbook)**

1. **Conexión:** SSH a prod-server.  
2. **Estructura:** mkdir \-p \~/scram-app/data/{postgres,redis}.  
3. **Secretos:** Crear archivo .env manual (No commitear).  
4. **Build:** docker compose build \--no-cache (Multi-stage builds para imágenes ligeras \<200MB).  
5. **Deploy:** docker compose up \-d.  
6. **Migración:** docker compose exec api npm run typeorm:migration:run.  
7. **Verificación:** curl https://api-scram.entersys.mx/health.

### **5.4 Plan de Rollback (Contingencia)**

* En caso de fallo crítico (ej. Crash Loop BackOff):  
  1. Revertir a la etiqueta de imagen anterior en docker-compose.yml.  
  2. Ejecutar docker compose up \-d.  
  3. Si hubo migración de DB destructiva, restaurar backup de volumen pg\_data desde snapshot diario de GCP.

## **6\. PLAN DE PRUEBAS UNITARIAS (UNIT TEST PLAN)**

El equipo de desarrollo debe garantizar cobertura mínima del 80% en lógica de negocio crítica.

| ID Caso | Escenario | Datos de Entrada | Resultado Esperado | Tipo |
| :---- | :---- | :---- | :---- | :---- |
| **UT-01** | Sincronización Idempotente | JSON Pedido Bind ID=X (Ya existente en DB) | Update del registro existente, NO duplicado (Count \= 1). | Lógica |
| **UT-02** | Priorización Automática | Pedido con Monto=$60,000 | priority\_level asignado a 2 (Alta) automáticamente. | Regla Negocio |
| **UT-03** | Cálculo de ETA | Ruta de 3 paradas, Salida 9:00 AM | Parada 1 ETA \~9:15-9:45. Validar buffer de tiempo. | Algoritmo |
| **UT-04** | Sync Offline PWA | Payload con fecha pasada (ayer) | Registro en evidence con flag is\_offline\_upload=true. | Integración |
| **UT-05** | Validación Capacidad | Asignar pedido \#16 al mismo chofer | Respuesta API contiene Warning/Error de capacidad. | Validación |

## **7\. HISTORIAL DE CAMBIOS Y APROBACIONES**

Registro de la evolución del documento para auditoría.

| Fecha | Versión | Autor | Revisor | Descripción del Cambio |
| :---- | :---- | :---- | :---- | :---- |
| 02/01/2026 | 5.0 | Arq. Software | Tech Lead | Versión Maestra Final. Alineación completa con MD050 v3.4 y Guía de Infraestructura EnterSys. Estrategia Offline-First y Dockerización definida. |

