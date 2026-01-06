# Manual de Usuario - Sistema de Gestión Logística SCRAM

**Versión:** 2.0
**Fecha:** Enero 2026
**URL Producción:** https://gestion-logistica.scram2k.com

---

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Roles y Permisos](#roles-y-permisos)
3. [Acceso al Sistema](#acceso-al-sistema)
4. [Pantallas por Rol](#pantallas-por-rol)
   - [Panel de Compras (PURCHASING)](#panel-de-compras-purchasing)
   - [Panel de Planificación (ADMIN)](#panel-de-planificación-admin)
   - [Gestión de Usuarios (ADMIN)](#gestión-de-usuarios-admin)
   - [Panel de Ventas (SALES)](#panel-de-ventas-sales)
   - [Dashboard Gerencial (DIRECTOR)](#dashboard-gerencial-director)
5. [Páginas Públicas](#páginas-públicas)
   - [Rastreo de Pedido](#rastreo-de-pedido)
   - [Encuesta de Satisfacción](#encuesta-de-satisfacción)
6. [Flujos de Trabajo](#flujos-de-trabajo)
7. [Paqueterías Externas](#paqueterías-externas)
8. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Introducción

El Sistema de Gestión Logística SCRAM es una plataforma integral diseñada para optimizar el proceso de entrega de pedidos, desde la sincronización con el ERP Bind hasta la confirmación de entrega y encuesta de satisfacción del cliente.

### Características Principales

- Sincronización automática con Bind ERP
- Gestión de pedidos por estados
- Asignación y despacho de rutas con choferes internos
- **Asignación a paqueterías externas** (FedEx, DHL, Estafeta, etc.)
- Notificaciones automáticas por email
- Rastreo público para clientes
- Encuestas de satisfacción (CSAT)
- Dashboard con KPIs en tiempo real
- **Vista de mapa interactivo con filtros por estado**

---

## Roles y Permisos

El sistema cuenta con 5 roles principales, cada uno con permisos específicos:

| Rol | Código | Descripción | Acceso Principal |
|-----|--------|-------------|------------------|
| **Analista de Compras** | PURCHASING | Sincroniza pedidos desde Bind y los libera a tráfico | `/compras` |
| **Jefe de Tráfico** | ADMIN | Planifica rutas, asigna choferes/paqueterías y despacha | `/planning` |
| **Chofer** | DRIVER | Visualiza y completa entregas asignadas | `/driver` (PWA móvil) |
| **Ventas/Comercial** | SALES | Consulta estado de pedidos (solo lectura) | `/ventas` |
| **Dirección/Gerencia** | DIRECTOR | Visualiza KPIs y métricas globales | `/dashboard` |

### Matriz de Permisos Detallada

| Función | PURCHASING | ADMIN | DRIVER | SALES | DIRECTOR |
|---------|:----------:|:-----:|:------:|:-----:|:--------:|
| Sincronizar con Bind | ✅ | ❌ | ❌ | ❌ | ❌ |
| Liberar pedidos a tráfico | ✅ | ❌ | ❌ | ❌ | ❌ |
| Revertir pedidos a borrador | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver mapa de pedidos | ❌ | ✅ | ❌ | ❌ | ❌ |
| Asignar choferes | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Asignar paqueterías externas** | ❌ | ✅ | ❌ | ❌ | ❌ |
| Despachar rutas | ❌ | ✅ | ❌ | ❌ | ❌ |
| Gestionar usuarios | ❌ | ✅ | ❌ | ❌ | ❌ |
| Consultar pedidos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver montos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver KPIs/Dashboard | ❌ | ✅ | ❌ | ❌ | ✅ |
| Completar entregas | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## Acceso al Sistema

### Pantalla de Login

**URL:** `https://gestion-logistica.scram2k.com/login`

#### Campos Requeridos

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Email** | Correo electrónico registrado | usuario@scram2k.com |
| **Contraseña** | Contraseña de acceso (mín. 6 caracteres) | ******** |

#### Proceso de Ingreso

1. Ingresa tu correo electrónico
2. Ingresa tu contraseña
3. Haz clic en **"Ingresar"**
4. El sistema te redirigirá automáticamente a tu panel según tu rol:
   - PURCHASING → `/compras`
   - ADMIN → `/planning`
   - DRIVER → `/driver`
   - SALES → `/ventas`
   - DIRECTOR → `/dashboard`

#### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "Credenciales inválidas" | Email o contraseña incorrectos | Verifica tus datos |
| "Usuario inactivo" | Cuenta deshabilitada | Contacta al administrador |

---

## Pantallas por Rol

---

### Panel de Compras (PURCHASING)

**URL:** `/compras`
**Rol requerido:** PURCHASING

Esta pantalla es el punto de entrada de los pedidos al sistema logístico. Aquí se sincronizan los pedidos desde Bind ERP y se liberan a tráfico una vez validada la existencia física de la mercancía.

#### Estructura de la Pantalla

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo SCRAM] Panel de Compras      [Sincronizar] [Salir]    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │ 25              │    │ 10              │                 │
│  │ Pendientes      │    │ Listos para     │                 │
│  │ de Validar      │    │ Tráfico         │                 │
│  └─────────────────┘    └─────────────────┘                 │
├─────────────────────────────────────────────────────────────┤
│ [Pendientes (25)] [Liberados (10)]                          │
├─────────────────────────────────────────────────────────────┤
│ Pedidos Pendientes de Validar    [Liberar a Tráfico (0)]    │
│ ┌───┬──────────┬─────────────┬─────┬────────┬─────┬───────┐ │
│ │ ☐ │ ID Bind  │ Cliente     │ RFC │ Monto  │Prior│Estado │ │
│ ├───┼──────────┼─────────────┼─────┼────────┼─────┼───────┤ │
│ │ ☐ │ FAC-1234 │ Cliente A   │ XXX │ $5,000 │Normal│Borrador│ │
│ │ ☑ │ FAC-1235 │ Cliente B   │ XXX │ $8,000 │Alta │Borrador│ │
│ └───┴──────────┴─────────────┴─────┴────────┴─────┴───────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Funcionalidades

##### 1. Sincronizar con Bind ERP

**Botón:** "Sincronizar" (esquina superior derecha)

**Proceso:**
1. Haz clic en "Sincronizar"
2. El botón mostrará un indicador de carga
3. Al completar, verás un mensaje con el resultado:
   - "Sincronización completada: X nuevos, Y actualizados"

**Notas:**
- Los pedidos nuevos entran con estado **DRAFT** (Borrador)
- Los pedidos existentes se actualizan con la información más reciente

##### 2. Pestaña "Pendientes"

Muestra los pedidos en estado **DRAFT** que aún no han sido liberados a tráfico.

**Columnas de la tabla:**

| Columna | Descripción |
|---------|-------------|
| ☐ | Checkbox para seleccionar el pedido |
| ID Bind | Identificador único del pedido en Bind |
| Cliente | Nombre del cliente |
| RFC | RFC del cliente |
| Monto | Valor total del pedido en pesos |
| Prioridad | Normal / Alta / Urgente |
| Estado | Borrador / Listo |

##### 3. Liberar Pedidos a Tráfico

**Botón:** "Liberar a Tráfico (N)"

**Proceso:**
1. Selecciona los pedidos que deseas liberar
2. El contador del botón mostrará la cantidad seleccionada
3. Haz clic en "Liberar a Tráfico"
4. Los pedidos pasarán de DRAFT a READY

**Importante:** Solo libera pedidos cuya existencia física haya sido verificada.

##### 4. Revertir Pedidos a Borrador

En la pestaña "Liberados", puedes seleccionar pedidos y usar "Revertir a Borrador" para regresarlos de READY a DRAFT.

**Restricciones:**
- Solo se pueden revertir pedidos en estado READY
- No se pueden revertir pedidos IN_TRANSIT o DELIVERED

---

### Panel de Planificación (ADMIN)

**URL:** `/planning`
**Rol requerido:** ADMIN

Esta es la pantalla principal para el Jefe de Tráfico. Permite visualizar pedidos en mapa y lista, asignar a choferes internos o paqueterías externas, y despachar rutas.

#### Estructura de la Pantalla (Versión 2.0)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Panel de Tráfico   🔄 👥 🚪  │ 📦12 Listos │ 🚚8 En Ruta │
├─────────────────────────────────────────────────────────────┤
│ [🔍 Buscar cliente, ID, RFC...]  [Sel. Todos] [Limpiar]     │
├─────────────────────────────────────────────────────────────┤
│ [Activos (20)] [Listos (12)] [En Ruta (8)] [Entregados (45)]│
├────────────────────────────┬────────────────────────────────┤
│                            │                                │
│   LISTA DE PEDIDOS         │        MAPA DE PEDIDOS         │
│                            │                                │
│ ┌────────────────────────┐ │    📍 📍                       │
│ │ ☐ Cliente A            │ │       📍   📍                  │
│ │   FAC-1234 | $5,000    │ │  📍        📍                  │
│ │   Col. Centro [Listo]  │ │       📍                       │
│ ├────────────────────────┤ │                                │
│ │ ☑ Cliente B            │ │                                │
│ │   FAC-1235 | $8,000    │ │  Leyenda:                      │
│ │   Col. Norte [Urgente] │ │  🔵 Listo  🟢 En Ruta          │
│ └────────────────────────┘ │  🔴 Urgente 🔷 Seleccionado    │
│                            │                                │
├────────────────────────────┴────────────────────────────────┤
│ [👤 Chofer (2)] [🏢 Paquetería] [▶️ Despachar (2)]          │
├─────────────────────────────────────────────────────────────┤
│                              [📋] [📋🗺️] [🗺️] ← Toggle vista │
└─────────────────────────────────────────────────────────────┘
```

#### Funcionalidades Principales

##### 1. Header Compacto con Estadísticas

El header muestra estadísticas en línea:
- **📦 Listos:** Pedidos en estado READY
- **🚚 En Ruta:** Pedidos en estado IN_TRANSIT
- **✅ Entregados:** Pedidos completados
- **⚠️ Urgentes:** Pedidos con prioridad crítica (si hay)

**Botones de acción:**
- 🔄 **Actualizar:** Refresca los datos
- 👥 **Usuarios:** Accede a gestión de usuarios
- 🚪 **Salir:** Cierra sesión

##### 2. Barra de Búsqueda y Selección

- **Campo de búsqueda:** Filtra por nombre de cliente, ID de Bind, RFC o nombre de chofer
- **Seleccionar todos:** Selecciona todos los pedidos "Listos" visibles
- **Limpiar:** Deselecciona todos los pedidos

##### 3. Pestañas de Filtrado por Estado

| Pestaña | Descripción |
|---------|-------------|
| **Activos** | Muestra READY + IN_TRANSIT (vista por defecto) |
| **Listos** | Solo pedidos READY (pendientes de asignar/despachar) |
| **En Ruta** | Solo pedidos IN_TRANSIT (ya despachados) |
| **Entregados** | Solo pedidos DELIVERED (completados) |

##### 4. Lista de Pedidos (Panel Izquierdo)

Cada tarjeta de pedido muestra:
- **Checkbox:** Para seleccionar el pedido
- **Nombre del cliente**
- **ID de Bind** (código de factura)
- **Ubicación:** Colonia y ciudad
- **Monto:** Valor del pedido
- **Estado:** Chip con el estado actual
- **Urgente:** Badge rojo si es prioridad crítica
- **Chofer asignado:** Si ya tiene chofer
- **Paquetería:** Si fue asignado a carrier externo

**Ordenamiento automático:**
1. Urgentes primero
2. Listos antes que En Ruta
3. Entregados al final

##### 5. Mapa de Pedidos (Panel Derecho)

Visualización geográfica de los pedidos con coordenadas.

**Colores de marcadores:**

| Color | Significado |
|-------|-------------|
| 🔵 Azul (#0284c7) | Pedido Listo (READY) |
| 🟢 Teal (#0d9488) | Pedido En Ruta (IN_TRANSIT) |
| 🔴 Rojo (#dc2626) | Pedido Urgente |
| 🔷 Azul oscuro (#1e40af) | Pedido Seleccionado |
| 🟢 Verde (#16a34a) | Pedido Entregado |

**Interacción:**
- Clic en marcador: Ver popup con detalles
- Los pedidos seleccionados muestran número de secuencia
- Línea punteada conecta los pedidos seleccionados (vista de ruta)

##### 6. Toggle de Vista

Botones en esquina inferior derecha:

| Botón | Vista |
|-------|-------|
| 📋 | Solo lista (100% ancho) |
| 📋🗺️ | Split 50/50 (lista + mapa) |
| 🗺️ | Solo mapa (100% ancho) |

##### 7. Barra de Acciones

###### Asignar Chofer

**Botón:** "👤 Chofer (N)"

**Proceso:**
1. Selecciona uno o más pedidos
2. Haz clic en "Chofer"
3. En el diálogo, selecciona un chofer del dropdown
4. Haz clic en "Asignar"

**Resultado:** Los pedidos quedan vinculados al chofer pero siguen en READY.

###### Asignar Paquetería Externa

**Botón:** "🏢 Paquetería"

**Proceso:**
1. Selecciona uno o más pedidos
2. Haz clic en "Paquetería"
3. En el diálogo:
   - Selecciona la paquetería (FedEx, DHL, Estafeta, etc.)
   - Si seleccionas "Otra", ingresa el nombre
   - Opcionalmente, ingresa el número de guía
4. Haz clic en "Asignar"

**Paqueterías disponibles:**
- FedEx
- DHL
- Estafeta
- Paquete Express
- Redpack
- UPS
- Otra (personalizada)

###### Despachar Ruta

**Botón:** "▶️ Despachar (N)"

**Proceso:**
1. Selecciona los pedidos a despachar
2. Haz clic en "Despachar"
3. En el diálogo:
   - Selecciona el chofer
   - Configura la hora de inicio (default: 09:00)
   - Revisa la lista de paradas
4. Haz clic en "Despachar"

**Resultado:**
- Los pedidos cambian a estado IN_TRANSIT
- Se calculan las ventanas ETA
- Se envían emails automáticos a los clientes con:
  - Hora estimada de llegada
  - Nombre del chofer
  - Link de rastreo

---

### Gestión de Usuarios (ADMIN)

**URL:** `/usuarios`
**Rol requerido:** ADMIN

Pantalla para administrar los usuarios del sistema.

#### Funcionalidades

##### Crear Usuario

**Campos del formulario:**

| Campo | Requerido | Descripción |
|-------|:---------:|-------------|
| Nombre | ✅ | Nombre del usuario |
| Apellido | ✅ | Apellido del usuario |
| Email | ✅ | Correo electrónico (usuario de acceso) |
| Contraseña | ✅ | Mínimo 6 caracteres |
| Rol | ✅ | ADMIN, PURCHASING, SALES, DRIVER, DIRECTOR |
| Teléfono | ❌ | Número de contacto |

##### Editar Usuario

Permite modificar datos excepto el email.

##### Activar/Desactivar Usuario

- Usuarios activos pueden acceder al sistema
- Usuarios inactivos no pueden iniciar sesión

---

### Panel de Ventas (SALES)

**URL:** `/ventas`
**Rol requerido:** SALES

Pantalla de solo lectura para que el equipo comercial consulte el estado de los pedidos.

#### Funcionalidades

- **Búsqueda:** Por cliente, RFC o ID de Bind
- **Lista de pedidos:** Con indicador visual de estado
- **Detalle del pedido:** Timeline de progreso, chofer, ETA, paquetería asignada
- **Notas internas:** Permite agregar comentarios

**Información visible en detalle:**
- ID Bind y datos del cliente
- Dirección de entrega
- Estado con timeline visual
- Chofer asignado (si aplica)
- **Paquetería asignada** (si aplica)
- **Número de guía** (si aplica)
- ETA o fecha de entrega

---

### Dashboard Gerencial (DIRECTOR)

**URL:** `/dashboard`
**Rol requerido:** DIRECTOR o ADMIN

Panel ejecutivo con KPIs y métricas del negocio.

#### Métricas Disponibles

| Métrica | Descripción |
|---------|-------------|
| **Total Pedidos** | Cantidad total en el sistema |
| **Tasa de Entrega** | Porcentaje de pedidos entregados |
| **CSAT Promedio** | Satisfacción promedio del cliente |
| **Por Estado** | Distribución DRAFT/READY/IN_TRANSIT/DELIVERED |
| **Por Prioridad** | Distribución Normal/Alta/Urgente |

---

## Páginas Públicas

### Rastreo de Pedido

**URL:** `/track/[hash]`
**Acceso:** Público (link enviado por email)

Permite al cliente ver el estado de su pedido en tiempo real.

**Información mostrada:**
- Estado actual con stepper visual
- Número de pedido (ID Bind)
- Dirección de entrega
- Chofer asignado (si entrega interna)
- **Paquetería y número de guía** (si entrega externa)
- ETA (hora estimada de llegada)

### Encuesta de Satisfacción

**URL:** `/survey/[hash]`
**Acceso:** Público

Sistema de calificación de 1 a 5 estrellas con emojis:

| Emoji | Puntuación | Etiqueta |
|:-----:|:----------:|----------|
| 😢 | 1 | Muy malo |
| 😟 | 2 | Malo |
| 😐 | 3 | Regular |
| 🙂 | 4 | Bueno |
| 😄 | 5 | Excelente |

Calificaciones de 1-2 generan alertas automáticas al equipo de calidad.

---

## Flujos de Trabajo

### Flujo Principal: Entrega con Chofer Interno

```
BIND ERP → COMPRAS → TRÁFICO → CHOFER → CLIENTE
   │          │          │         │         │
   ▼          ▼          ▼         ▼         ▼
Factura   Validar    Asignar   Entregar   Calificar
creada    y liberar  y despachar          (CSAT)
   │          │          │         │
   ▼          ▼          ▼         ▼
 DRAFT     READY    IN_TRANSIT  DELIVERED
```

### Flujo Alternativo: Entrega con Paquetería Externa

```
BIND ERP → COMPRAS → TRÁFICO → PAQUETERÍA → CLIENTE
   │          │          │          │           │
   ▼          ▼          ▼          ▼           ▼
Factura   Validar    Asignar    Envío      Calificar
creada    y liberar  carrier    externo    (CSAT)
   │          │          │          │
   ▼          ▼          ▼          ▼
 DRAFT     READY    IN_TRANSIT  DELIVERED
```

### Detalle por Etapa

| Etapa | Actor | Acción | Estado Resultante |
|-------|-------|--------|-------------------|
| 1 | Sistema | Sincroniza desde Bind | DRAFT |
| 2 | Compras | Valida existencia física | DRAFT |
| 3 | Compras | Libera a tráfico | READY |
| 4a | Tráfico | Asigna chofer interno | READY |
| 4b | Tráfico | Asigna paquetería externa | READY → IN_TRANSIT |
| 5 | Tráfico | Despacha ruta (si chofer interno) | IN_TRANSIT |
| 6 | Sistema | Envía email ETA | IN_TRANSIT |
| 7 | Chofer/Paquetería | Entrega pedido | DELIVERED |
| 8 | Sistema | Envía email + encuesta | DELIVERED |
| 9 | Cliente | Califica experiencia | DELIVERED |

---

## Paqueterías Externas

### Carriers Soportados

| Carrier | Código | Descripción |
|---------|--------|-------------|
| **Interno** | INTERNAL | Entrega con choferes propios (default) |
| **FedEx** | FEDEX | FedEx Express |
| **DHL** | DHL | DHL Express |
| **Estafeta** | ESTAFETA | Estafeta Mexicana |
| **Paquete Express** | PAQUETE_EXPRESS | Paquete Express |
| **Redpack** | REDPACK | Redpack |
| **UPS** | UPS | United Parcel Service |
| **Otra** | OTHER | Paquetería personalizada |

### Proceso de Asignación

1. Desde `/planning`, selecciona los pedidos
2. Haz clic en "🏢 Paquetería"
3. Selecciona el carrier del dropdown
4. Si es "Otra", ingresa el nombre personalizado
5. Ingresa el número de guía (opcional pero recomendado)
6. Haz clic en "Asignar"

### Visualización

- En la lista de pedidos: Chip con el nombre del carrier
- En el detalle: Carrier y número de guía
- En rastreo público: Cliente ve la paquetería asignada

---

## Preguntas Frecuentes

### General

**P: ¿Qué navegadores son compatibles?**
R: Chrome, Firefox, Safari y Edge en sus versiones más recientes.

**P: ¿El sistema funciona en móvil?**
R: Sí, todas las pantallas son responsivas. La PWA para choferes está optimizada para móvil.

### Compras

**P: ¿Con qué frecuencia debo sincronizar con Bind?**
R: Se recomienda sincronizar al inicio de cada jornada y después de capturar nuevas facturas.

**P: ¿Puedo revertir un pedido que ya está en ruta?**
R: No. Solo se pueden revertir pedidos en estado READY.

### Tráfico

**P: ¿Cuál es la diferencia entre asignar chofer y despachar?**
R: Asignar solo vincula el chofer al pedido. Despachar inicia la ruta, cambia el estado a IN_TRANSIT y envía notificaciones.

**P: ¿Cuándo uso paquetería externa vs chofer interno?**
R: Usa paquetería externa para envíos foráneos o cuando no hay capacidad interna. Usa chofer interno para entregas locales.

**P: ¿Puedo cambiar el carrier después de asignarlo?**
R: Sí, mientras el pedido esté en READY. Una vez despachado, contacta a soporte.

**P: ¿Cómo veo solo los pedidos urgentes?**
R: Usa la pestaña "Activos" y busca los pedidos con badge rojo. Siempre aparecen primero en la lista.

**P: ¿Cómo cambio entre vista de lista y mapa?**
R: Usa los botones en la esquina inferior derecha: 📋 (solo lista), 📋🗺️ (split), 🗺️ (solo mapa).

### Clientes

**P: ¿Cuánto tiempo es válido el link de rastreo?**
R: El link es válido hasta 24 horas después de la entrega.

**P: ¿Cómo sé si mi pedido va con paquetería externa?**
R: En la página de rastreo verás el nombre de la paquetería y número de guía en lugar del nombre del chofer.

---

## Soporte

Para soporte técnico o reportar problemas:

- **Email:** soporte@scram2k.com
- **Teléfono:** +52 (81) 1234-5678
- **Horario:** Lunes a Viernes 9:00 - 18:00

---

*SCRAM 2026 - Sistema de Gestión Logística v2.0*
*Todos los derechos reservados*
