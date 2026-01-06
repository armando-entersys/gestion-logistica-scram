# Manual de Usuario - Sistema de Gestión Logística SCRAM

**Versión:** 1.0
**Fecha:** Enero 2026
**URL Producción:** https://api-gestion-logistica.scram2k.com

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
7. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Introducción

El Sistema de Gestión Logística SCRAM es una plataforma integral diseñada para optimizar el proceso de entrega de pedidos, desde la sincronización con el ERP Bind hasta la confirmación de entrega y encuesta de satisfacción del cliente.

### Características Principales

- Sincronización automática con Bind ERP
- Gestión de pedidos por estados
- Asignación y despacho de rutas
- Notificaciones automáticas por email
- Rastreo público para clientes
- Encuestas de satisfacción (CSAT)
- Dashboard con KPIs en tiempo real

---

## Roles y Permisos

El sistema cuenta con 4 roles principales, cada uno con permisos específicos:

| Rol | Código | Descripción | Acceso Principal |
|-----|--------|-------------|------------------|
| **Analista de Compras** | PURCHASING | Sincroniza pedidos desde Bind y los libera a tráfico | `/compras` |
| **Jefe de Tráfico** | ADMIN | Planifica rutas, asigna choferes y despacha | `/planning` |
| **Ventas/Comercial** | SALES | Consulta estado de pedidos (solo lectura) | `/ventas` |
| **Dirección/Gerencia** | DIRECTOR | Visualiza KPIs y métricas globales | `/dashboard` |

### Matriz de Permisos Detallada

| Función | PURCHASING | ADMIN | SALES | DIRECTOR |
|---------|:----------:|:-----:|:-----:|:--------:|
| Sincronizar con Bind | ✅ | ❌ | ❌ | ❌ |
| Liberar pedidos a tráfico | ✅ | ❌ | ❌ | ❌ |
| Revertir pedidos a borrador | ✅ | ✅ | ❌ | ❌ |
| Ver mapa de pedidos | ❌ | ✅ | ❌ | ❌ |
| Asignar choferes | ❌ | ✅ | ❌ | ❌ |
| Despachar rutas | ❌ | ✅ | ❌ | ❌ |
| Gestionar usuarios | ❌ | ✅ | ❌ | ❌ |
| Consultar pedidos | ✅ | ✅ | ✅ | ✅ |
| Ver montos | ✅ | ✅ | ✅ | ✅ |
| Ver KPIs/Dashboard | ❌ | ✅ | ❌ | ✅ |
| Agregar notas internas | ❌ | ✅ | ✅ | ❌ |

---

## Acceso al Sistema

### Pantalla de Login

**URL:** `https://api-gestion-logistica.scram2k.com/login`

![Login](./docs/login.png)

#### Campos Requeridos

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Email** | Correo electrónico registrado | usuario@scram.com |
| **Contraseña** | Contraseña de acceso | ******** |

#### Proceso de Ingreso

1. Ingresa tu correo electrónico
2. Ingresa tu contraseña
3. Haz clic en **"Iniciar Sesión"**
4. El sistema te redirigirá automáticamente a tu panel según tu rol:
   - PURCHASING → `/compras`
   - ADMIN → `/planning`
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
│ [Logo] Panel de Compras          [Sincronizar Bind] [Salir] │
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

**Botón:** "Sincronizar Bind" (esquina superior derecha)

**Descripción:** Obtiene los pedidos pendientes desde el ERP Bind y los importa al sistema.

**Proceso:**
1. Haz clic en "Sincronizar Bind"
2. El botón mostrará un indicador de carga
3. Al completar, verás un mensaje con el resultado:
   - "Sincronización completada: X nuevos, Y actualizados"

**Notas:**
- Los pedidos nuevos entran con estado **DRAFT** (Borrador)
- Los pedidos existentes se actualizan con la información más reciente
- La sincronización puede tomar hasta 2 minutos si hay muchos pedidos

##### 2. Pestaña "Pendientes"

Muestra los pedidos en estado **DRAFT** que aún no han sido liberados a tráfico.

**Columnas de la tabla:**

| Columna | Descripción |
|---------|-------------|
| ☐ | Checkbox para seleccionar el pedido |
| ID Bind | Identificador único del pedido en Bind (ej: FAC-A1234) |
| Cliente | Nombre del cliente |
| RFC | RFC del cliente |
| Monto | Valor total del pedido en pesos |
| Prioridad | Normal / Alta / Urgente |
| Estado | Borrador / Listo |

**Acciones disponibles:**
- **Seleccionar pedidos:** Haz clic en la fila o en el checkbox
- **Liberar a Tráfico:** Selecciona uno o más pedidos y haz clic en "Liberar a Tráfico (N)"

##### 3. Liberar Pedidos a Tráfico

**Botón:** "Liberar a Tráfico (N)"

**Descripción:** Cambia el estado de los pedidos seleccionados de DRAFT a READY, haciéndolos visibles para el equipo de tráfico.

**Proceso:**
1. Selecciona los pedidos que deseas liberar (checkbox o clic en fila)
2. El contador del botón mostrará la cantidad seleccionada
3. Haz clic en "Liberar a Tráfico"
4. Los pedidos desaparecerán de esta pestaña y aparecerán en "Liberados"

**Importante:** Solo libera pedidos cuya existencia física haya sido verificada.

##### 4. Pestaña "Liberados"

Muestra los pedidos en estado **READY** que ya fueron liberados a tráfico pero aún no han sido despachados.

**Acciones disponibles:**
- **Revertir a Borrador:** Selecciona pedidos y haz clic en "Revertir a Borrador (N)"

##### 5. Revertir Pedidos a Borrador

**Botón:** "Revertir a Borrador (N)"

**Descripción:** Regresa pedidos de READY a DRAFT. Útil cuando se liberó un pedido por error o se necesita hacer correcciones.

**Proceso:**
1. Ve a la pestaña "Liberados"
2. Selecciona los pedidos a revertir
3. Haz clic en "Revertir a Borrador"
4. Los pedidos volverán a la pestaña "Pendientes"

**Restricciones:**
- Solo se pueden revertir pedidos en estado READY
- No se pueden revertir pedidos que ya están EN_TRANSIT o DELIVERED

##### 6. Cerrar Sesión

**Botón:** "Salir"

Cierra la sesión actual y redirige a la pantalla de login.

---

### Panel de Planificación (ADMIN)

**URL:** `/planning`
**Rol requerido:** ADMIN

Esta pantalla permite al Jefe de Tráfico visualizar los pedidos en un mapa, asignar choferes y despachar rutas.

#### Estructura de la Pantalla

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Panel de Tráfico    [Usuarios] [Despachar] [Salir]   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ │
│  │ 35 Listos       │ │ 12 En Ruta      │ │ 8 Entregados   │ │
│  └─────────────────┘ └─────────────────┘ └────────────────┘ │
├───────────────────────────────┬─────────────────────────────┤
│                               │ Lista de Pedidos            │
│      [MAPA DE PEDIDOS]        │ ┌─────────────────────────┐ │
│                               │ │ ☐ FAC-1234 - Cliente A  │ │
│       📍 📍                    │ │ ☐ FAC-1235 - Cliente B  │ │
│    📍      📍                  │ │ ☑ FAC-1236 - Cliente C  │ │
│        📍                      │ └─────────────────────────┘ │
│                               │ Chofer: [Seleccionar ▼]     │
│                               │ [Asignar Chofer]            │
└───────────────────────────────┴─────────────────────────────┘
```

#### Funcionalidades

##### 1. Mapa de Pedidos

Visualización geográfica de todos los pedidos con coordenadas.

**Marcadores:**
- 🟡 Amarillo: Pedidos READY (listos para asignar)
- 🔵 Azul: Pedidos IN_TRANSIT (en camino)
- 🟢 Verde: Pedidos DELIVERED (entregados)
- 🔴 Rojo: Pedidos con prioridad URGENTE

**Interacción:**
- Haz clic en un marcador para ver detalles del pedido
- Arrastra el mapa para navegar
- Usa los controles de zoom para acercar/alejar

##### 2. Lista de Pedidos

Panel lateral con la lista de pedidos filtrable.

**Filtros disponibles:**
- Por estado (READY, IN_TRANSIT, DELIVERED)
- Por prioridad (Normal, Alta, Urgente)
- Por chofer asignado
- Búsqueda por cliente o ID

##### 3. Asignar Chofer

**Proceso:**
1. Selecciona uno o más pedidos de la lista
2. Selecciona un chofer del dropdown
3. Haz clic en "Asignar Chofer"
4. Los pedidos quedarán vinculados al chofer seleccionado

**Validaciones:**
- Máximo 15 pedidos por chofer (configurable)
- Si se excede, aparece una advertencia pero permite continuar

##### 4. Despachar Ruta

**Botón:** "Despachar"

**Descripción:** Inicia la ruta del chofer seleccionado, enviando notificaciones ETA a todos los clientes.

**Proceso:**
1. Asegúrate de que el chofer tenga pedidos asignados
2. Haz clic en "Despachar"
3. Opcionalmente, configura la hora de inicio
4. Confirma el despacho

**Resultado:**
- Los pedidos cambian a estado IN_TRANSIT
- Se calculan las ventanas ETA para cada pedido
- Se envían emails automáticos a los clientes con:
  - Hora estimada de llegada
  - Nombre del chofer
  - Link de rastreo

##### 5. Gestión de Usuarios

**Botón:** "Usuarios"

Acceso directo a la pantalla de gestión de usuarios (`/usuarios`).

---

### Gestión de Usuarios (ADMIN)

**URL:** `/usuarios`
**Rol requerido:** ADMIN

Pantalla para administrar los usuarios del sistema.

#### Estructura de la Pantalla

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Gestión de Usuarios              [+ Nuevo] [Salir]   │
├─────────────────────────────────────────────────────────────┤
│ [Buscar usuario...]                                         │
├─────────────────────────────────────────────────────────────┤
│ ┌────────┬───────────────┬──────────────┬────────┬────────┐ │
│ │ Nombre │ Email         │ Rol          │ Estado │Acciones│ │
│ ├────────┼───────────────┼──────────────┼────────┼────────┤ │
│ │ Juan   │ juan@scram.com│ Administrador│ Activo │ ✏️ 🗑️  │ │
│ │ María  │ maria@scram.com│ Compras     │ Activo │ ✏️ 🗑️  │ │
│ │ Pedro  │ pedro@scram.com│ Chofer      │Inactivo│ ✏️ 🗑️  │ │
│ └────────┴───────────────┴──────────────┴────────┴────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Funcionalidades

##### 1. Crear Usuario

**Botón:** "+ Nuevo Usuario"

**Campos del formulario:**

| Campo | Requerido | Descripción |
|-------|:---------:|-------------|
| Nombre | ✅ | Nombre del usuario |
| Apellido | ✅ | Apellido del usuario |
| Email | ✅ | Correo electrónico (será el usuario de acceso) |
| Contraseña | ✅ | Mínimo 8 caracteres |
| Rol | ✅ | ADMIN, PURCHASING, SALES, DRIVER |
| Teléfono | ❌ | Número de contacto |

##### 2. Editar Usuario

**Botón:** ✏️ (en la fila del usuario)

Permite modificar los datos del usuario excepto el email.

##### 3. Activar/Desactivar Usuario

**Botón:** 🗑️ (en la fila del usuario)

- Usuarios activos pueden acceder al sistema
- Usuarios inactivos no pueden iniciar sesión
- No se eliminan permanentemente (solo se desactivan)

##### 4. Buscar Usuarios

Campo de búsqueda que filtra por nombre, apellido o email.

---

### Panel de Ventas (SALES)

**URL:** `/ventas`
**Rol requerido:** SALES

Pantalla de solo lectura para que el equipo comercial consulte el estado de los pedidos.

#### Estructura de la Pantalla

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Portal de Ventas                            [Salir]  │
├─────────────────────────────────────────────────────────────┤
│ [🔍 Buscar por cliente, RFC o ID...]                        │
├────────────────────────────────┬────────────────────────────┤
│ Lista de Pedidos               │ Detalle del Pedido         │
│ ┌────────────────────────────┐ │ ┌────────────────────────┐ │
│ │ FAC-1234                   │ │ │ FAC-1234               │ │
│ │ Cliente A                  │ │ │ Cliente A              │ │
│ │ [En Ruta]                  │ │ │ RFC: XAXX010101000     │ │
│ ├────────────────────────────┤ │ │                        │ │
│ │ FAC-1235                   │ │ │ Estado:                │ │
│ │ Cliente B                  │ │ │ ○ Recibido             │ │
│ │ [Entregado] ✓              │ │ │ ○ Preparación          │ │
│ └────────────────────────────┘ │ │ ● En Ruta              │ │
│                                │ │ ○ Entregado            │ │
│                                │ │                        │ │
│                                │ │ Chofer: Juan Pérez     │ │
│                                │ │ ETA: 14:30 - 15:00     │ │
│                                │ └────────────────────────┘ │
└────────────────────────────────┴────────────────────────────┘
```

#### Funcionalidades

##### 1. Búsqueda de Pedidos

Campo de búsqueda para encontrar pedidos por:
- Nombre de cliente
- RFC
- ID de Bind

##### 2. Lista de Pedidos

Muestra todos los pedidos con indicador visual de estado.

**Estados mostrados:**
- Recibido (DRAFT)
- Preparación (READY)
- En Ruta (IN_TRANSIT)
- Entregado (DELIVERED)

##### 3. Detalle del Pedido

Al seleccionar un pedido, se muestra:

| Información | Descripción |
|-------------|-------------|
| ID Bind | Número de factura |
| Cliente | Nombre del cliente |
| RFC | RFC del cliente |
| Dirección | Dirección de entrega |
| Monto | Valor del pedido |
| Estado | Timeline visual del progreso |
| Chofer | Nombre del chofer asignado (si aplica) |
| ETA | Hora estimada de llegada (si está en ruta) |
| Entregado | Fecha y hora de entrega (si aplica) |

##### 4. Agregar Nota Interna

Permite agregar comentarios internos al pedido para seguimiento de calidad.

---

### Dashboard Gerencial (DIRECTOR)

**URL:** `/dashboard`
**Rol requerido:** DIRECTOR o ADMIN

Panel ejecutivo con KPIs y métricas del negocio.

#### Estructura de la Pantalla

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Dashboard Ejecutivo                         [Salir]  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │   150    │ │   92%    │ │   4.5    │ │ $2.5M    │        │
│  │ Pedidos  │ │ Tasa     │ │ CSAT     │ │ Ingresos │        │
│  │ Totales  │ │ Entrega  │ │ Promedio │ │ Mes      │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────────────────┤
│  Pedidos por Estado                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Borrador    ████████████████░░░░░░░░░░░░░░░ 45      │    │
│  │ Listo       ████████████░░░░░░░░░░░░░░░░░░░ 35      │    │
│  │ En Ruta     ████████░░░░░░░░░░░░░░░░░░░░░░░ 25      │    │
│  │ Entregado   ███████████████████████████████ 95      │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Pedidos por Prioridad                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Normal      ███████████████████████████████ 120     │    │
│  │ Alta        ████████████░░░░░░░░░░░░░░░░░░░ 25      │    │
│  │ Urgente     ████░░░░░░░░░░░░░░░░░░░░░░░░░░░ 5       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

#### Métricas Disponibles

| Métrica | Descripción | Fórmula |
|---------|-------------|---------|
| **Total Pedidos** | Cantidad total de pedidos en el sistema | COUNT(*) |
| **Tasa de Entrega** | Porcentaje de pedidos entregados | DELIVERED / TOTAL × 100 |
| **CSAT Promedio** | Satisfacción promedio del cliente | AVG(csat_score) |
| **Ingresos** | Suma de montos de pedidos | SUM(total_amount) |

#### Gráficos

##### Pedidos por Estado
Muestra la distribución de pedidos según su estado actual:
- DRAFT (Borrador)
- READY (Listo)
- IN_TRANSIT (En Ruta)
- DELIVERED (Entregado)

##### Pedidos por Prioridad
Muestra la distribución por nivel de prioridad:
- Normal
- Alta
- Urgente/Crítica

---

## Páginas Públicas

Las siguientes páginas son accesibles sin autenticación y están diseñadas para los clientes finales.

---

### Rastreo de Pedido

**URL:** `/track/[hash]`
**Acceso:** Público (link enviado por email)

Permite al cliente final ver el estado de su pedido en tiempo real.

#### Estructura de la Pantalla

```
┌─────────────────────────────────────────────────────────────┐
│ 🚚 Rastreo de Pedido                                        │
│    SCRAM Logística                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Estado actual                              [📦]            │
│  EN CAMINO                                                  │
│                                                             │
│  ○ Recibido → ○ Preparación → ● En Camino → ○ Entregado    │
│                                                             │
│  ████████████████████████░░░░░░░░░░░░░░░░                   │
│  Tu pedido está en camino                                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ INFORMACIÓN DEL PEDIDO                                      │
│                                                             │
│ 📄 Número de Pedido                                         │
│    FAC-A1234                                                │
│                                                             │
│ 📍 Dirección de Entrega                                     │
│    Av. Principal 123                                        │
│    Col. Centro, Monterrey                                   │
│                                                             │
│ 👤 Chofer Asignado                                          │
│    Juan Pérez                                               │
│                                                             │
│ 🕐 Hora Estimada de Llegada                                 │
│    14:30 - 15:00                                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ⭐ Califica tu experiencia                                  │
│    Tu opinión nos ayuda a mejorar                           │
│    [    Dejar Calificación    ]                             │
└─────────────────────────────────────────────────────────────┘
```

#### Información Mostrada

| Elemento | Descripción |
|----------|-------------|
| **Estado** | Estado actual del pedido con stepper visual |
| **Número de Pedido** | ID de la factura en Bind |
| **Dirección** | Dirección de entrega |
| **Chofer** | Nombre del chofer asignado (si está en ruta) |
| **ETA** | Ventana de hora estimada de llegada |

#### Estados del Pedido

1. **Recibido** - El pedido fue registrado en el sistema
2. **Preparación** - El pedido está siendo preparado para envío
3. **En Camino** - El chofer está en ruta hacia la dirección
4. **Entregado** - El pedido fue entregado exitosamente

#### Link de Encuesta

Una vez que el pedido es entregado, aparece un botón para dejar calificación que lleva a la encuesta CSAT.

---

### Encuesta de Satisfacción

**URL:** `/survey/[hash]`
**Acceso:** Público (link enviado por email o desde rastreo)

Permite al cliente calificar su experiencia de entrega.

#### Estructura de la Pantalla

```
┌─────────────────────────────────────────────────────────────┐
│ ⭐ Califica tu Experiencia                                  │
│    SCRAM Logística                                          │
├─────────────────────────────────────────────────────────────┤
│ PEDIDO #FAC-A1234                                           │
│ Cliente ABC                                                 │
│ Entregado el 05/01/2026                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│        ¿Cómo fue tu experiencia de entrega?                 │
│                                                             │
│           😢    😟    😐    🙂    😄                         │
│                            [●]                              │
│                                                             │
│                         Bueno                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Comentarios adicionales (opcional)                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Cuéntanos más sobre tu experiencia...                   │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [          Enviar Calificación          ]                   │
│                                                             │
│              Volver al rastreo                              │
└─────────────────────────────────────────────────────────────┘
```

#### Sistema de Calificación

| Emoji | Puntuación | Etiqueta |
|:-----:|:----------:|----------|
| 😢 | 1 | Muy malo |
| 😟 | 2 | Malo |
| 😐 | 3 | Regular |
| 🙂 | 4 | Bueno |
| 😄 | 5 | Excelente |

#### Proceso

1. Selecciona una calificación (1-5 estrellas)
2. Opcionalmente, escribe un comentario
3. Haz clic en "Enviar Calificación"
4. Verás un mensaje de agradecimiento

#### Alertas de Detractor

Cuando un cliente califica con 1 o 2 estrellas (detractor), el sistema envía automáticamente una alerta al equipo de calidad para seguimiento.

---

## Flujos de Trabajo

### Flujo Completo de un Pedido

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    BIND     │────▶│   COMPRAS   │────▶│   TRÁFICO   │────▶│   CHOFER    │
│    ERP      │     │  Validación │     │ Planificación│     │   Entrega   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
   Factura            Pedido en           Pedido en           Pedido
   creada             DRAFT               READY               DELIVERED
                                              │
                                              ▼
                                         Asignación
                                         a chofer
                                              │
                                              ▼
                                          Despacho
                                          de ruta
                                              │
                                              ▼
                                         Email ETA
                                         al cliente
```

### Detalle por Etapa

| Etapa | Actor | Acción | Estado Resultante |
|-------|-------|--------|-------------------|
| 1 | Sistema | Sincroniza desde Bind | DRAFT |
| 2 | Compras | Valida existencia física | DRAFT |
| 3 | Compras | Libera a tráfico | READY |
| 4 | Tráfico | Asigna chofer | READY |
| 5 | Tráfico | Despacha ruta | IN_TRANSIT |
| 6 | Sistema | Envía email ETA | IN_TRANSIT |
| 7 | Chofer | Entrega pedido | DELIVERED |
| 8 | Sistema | Envía email + encuesta | DELIVERED |
| 9 | Cliente | Califica experiencia | DELIVERED |

---

## Preguntas Frecuentes

### General

**P: ¿Qué navegadores son compatibles?**
R: Chrome, Firefox, Safari y Edge en sus versiones más recientes.

**P: ¿El sistema funciona en móvil?**
R: Sí, todas las pantallas son responsivas. La PWA para choferes está optimizada para móvil.

### Compras

**P: ¿Con qué frecuencia debo sincronizar con Bind?**
R: Se recomienda sincronizar al inicio de cada jornada y después de capturar nuevas facturas en Bind.

**P: ¿Puedo revertir un pedido que ya está en ruta?**
R: No. Solo se pueden revertir pedidos en estado READY. Contacta a tráfico para casos especiales.

### Tráfico

**P: ¿Cuántos pedidos puede llevar un chofer?**
R: El límite recomendado es 15 pedidos. El sistema permite asignar más pero mostrará una advertencia.

**P: ¿Cómo se calculan las horas ETA?**
R: Se calcula en base a la posición en la ruta, 30 minutos promedio por parada, y un buffer de 15% por tráfico.

### Clientes

**P: ¿Cuánto tiempo es válido el link de rastreo?**
R: El link es válido hasta 24 horas después de la entrega.

**P: ¿Puedo cambiar mi calificación?**
R: No, solo se permite una calificación por pedido.

---

## Soporte

Para soporte técnico o reportar problemas:

- **Email:** soporte@scram2k.com
- **Teléfono:** +52 (81) 1234-5678
- **Horario:** Lunes a Viernes 9:00 - 18:00

---

*SCRAM 2026 - Sistema de Gestión Logística*
*Todos los derechos reservados*
