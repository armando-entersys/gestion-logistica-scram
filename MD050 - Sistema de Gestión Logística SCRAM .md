# **MD050 \- Especificación de Diseño Funcional Detallado**

## **Sistema de Gestión Logística SCRAM (Módulo de Despacho y Última Milla)**

| Control de Documento |  |
| :---- | :---- |
| **Código del Proyecto** | SCRAM-LOG-01 |
| **Nombre del Artefacto** | MD050 \- Application Extension Functional Design |
| **Versión** | 3.4 (Versión Final \- Con Mejoras de Resiliencia y Seguridad) |
| **Fecha** | 30/12/2025 |
| **Estado** | Aprobado para Desarrollo |
| **Autor** | Arquitecto de Soluciones Senior |
| **Fuente de Datos** | Entrevista (Noemi Agustín) / Bind ERP API Documentation |

## **1\. Resumen Ejecutivo y Alcance del Negocio**

El presente documento constituye la especificación funcional completa y detallada para el desarrollo del **Módulo de Despacho y Asignación de Rutas SCRAM**. Este sistema centraliza la operación logística, actuando como el núcleo que conecta las áreas de Compras, Logística y Ventas, transformando un proceso manual y fragmentado en un flujo digital optimizado.

### **1.1 Contexto y Justificación del Negocio**

Actualmente, la operación logística depende de la transferencia manual de información y del conocimiento tribal de los operadores. Esto genera riesgos operativos significativos, como la pérdida de información, asignación ineficiente de rutas y falta de visibilidad para el cliente final.

**Objetivo Estratégico:** Implementar una plataforma integral (Middleware Logístico) que gestione el despacho físico con trazabilidad digital. El sistema tiene tres pilares fundamentales:

1. **Eficiencia Operativa:** Eliminar la recaptura de datos entre Bind ERP y hojas de cálculo.  
2. **Visibilidad Comercial:** Empoderar al equipo de Ventas con estatus en tiempo real, reduciendo la fricción interna.  
3. **Experiencia del Cliente (CX):** Mejorar radicalmente la satisfacción del cliente final mediante notificaciones proactivas de "Pedido en Camino" y cálculos de ETA, asegurando una recepción exitosa en el primer intento y cerrando el ciclo con encuestas de satisfacción.

## **2\. Arquitectura de la Solución**

### **2.1 Diagrama de Contexto del Sistema**

El siguiente diagrama ilustra cómo SCRAM interactúa con los distintos actores humanos y sistemas externos, estableciendo límites claros de responsabilidad.

graph TD  
    %% Actores Internos  
    Purchasing((Rol Compras)) \--\>|1. Valida y Libera Pedidos| SCRAM\_Sys  
    Traffic((Rol Tráfico)) \--\>|2. Planifica y Asigna Rutas| SCRAM\_Sys  
    Driver((Rol Chofer)) \--\>|3. Ejecuta Entrega y Recaba Evidencia| SCRAM\_Sys  
    Sales((Rol Ventas)) \--\>|4. Consulta Estatus y Reportes| SCRAM\_Sys  
      
    %% Actores Externos  
    Client((Cliente Final)) \--\>|5. Recibe Alertas y Califica| SCRAM\_Sys  
      
    %% Sistemas e Integraciones  
    SCRAM\_Sys\[Sistema SCRAM Core\] \--\>|Sincronización Unidireccional| BindAPI\[Bind ERP API\]  
    SCRAM\_Sys \--\>|Geocodificación y Mapas| GMaps\[Google Maps API\]  
    SCRAM\_Sys \--\>|Envío Transaccional| SMTP\[Servidor Correo / SendGrid\]  
      
    subgraph "Nube SCRAM (Infraestructura)"  
    SCRAM\_Sys  
    DB\[(Base de Datos Relacional)\]  
    Worker\[Background Jobs Worker\]  
    end

### **2.2 Diagrama de Flujo Detallado: Ciclo de Notificación y Entrega**

Este flujo detalla la secuencia lógica desde la decisión de despacho hasta la retroalimentación del cliente, destacando los procesos automáticos.

sequenceDiagram  
    participant Trafico as Jefe Tráfico  
    participant Sys as SCRAM System  
    participant Worker as Async Worker  
    participant Client as Cliente Final  
    participant Driver as Chofer

    Note over Trafico: Fase de Planeación  
    Trafico-\>\>Sys: Selecciona 5 pedidos en Mapa  
    Trafico-\>\>Sys: Asigna a Chofer Juan  
    Trafico-\>\>Sys: Clic "Confirmar Despacho"  
      
    Note over Sys: Procesamiento Asíncrono  
    Sys-\>\>Worker: Encolar Tarea "Notificar\_Ruta"  
    Worker-\>\>Worker: Calcular ETA por secuencia  
    loop Para cada Cliente en la Ruta  
        Worker-\>\>Client: 📧 Email: "Tu pedido va en camino (Llega \~10:30 AM)"  
    end  
      
    Note over Driver: Fase de Ejecución  
    Driver-\>\>Client: Entrega Física  
    Driver-\>\>Sys: Captura Firma/Foto (POD)  
    Driver-\>\>Sys: Marca "Entregado"  
      
    Note over Sys: Cierre de Ciclo  
    Sys-\>\>Worker: Encolar Tarea "Encuesta\_Satisfaccion"  
    Worker-\>\>Client: 📧 Email: "Comprobante \+ Encuesta CSAT"

## **3\. Requerimientos Funcionales Detallados**

Esta sección desglosa cada funcionalidad con un nivel de detalle suficiente para su implementación técnica y validación de QA.

### **RF-01: Sincronización Controlada con Bind ERP**

**Descripción:** El sistema debe extraer información de pedidos de venta desde Bind ERP bajo demanda, asegurando que solo se procesen órdenes administrativa y financieramente listas.

* **Mecanismo de Disparo:**  
  * **Manual Exclusivo:** Botón "Sincronizar" en el panel de Compras. Se descarta la sincronización automática (polling) para evitar cambios inesperados en la interfaz de usuario durante la operación.  
* **Lógica de Integración:**  
  * Consumo del endpoint /api/Orders de Bind ERP.  
  * **Filtros de Negocio:** Solo se importarán pedidos con estatus Facturada o Emitida. Los pedidos en borrador o cotización serán ignorados.  
  * **Idempotencia:** El sistema verificará si el Bind\_ID ya existe localmente. Si existe, actualizará los campos permitidos; si no, creará un nuevo registro.  
  * **Manejo de Errores Parciales:** En caso de que un lote de pedidos contenga errores (ej. 49 exitosos, 1 fallido por datos corruptos), el sistema debe procesar los exitosos y generar un reporte de "Excepciones de Sincronización" para revisión manual, en lugar de rechazar todo el lote.  
* **Manejo de Errores Críticos:**  
  * Si la API de Bind no responde (Timeout \> 30s) o devuelve error 5xx, el sistema mostrará una alerta clara al usuario y habilitará temporalmente el botón de "Carga Manual por Excel" como contingencia.

### **RF-02: Motor de Priorización Inteligente Parametrizables**

**Descripción:** Algoritmo automático que clasifica la urgencia de los envíos basándose en reglas de negocio configurables, eliminando la subjetividad.

* **Reglas de Negocio:**  
  * **Prioridad CRÍTICA (Rojo):** Se asigna si Fecha\_Entrega\_Prometida \< HOY (Pedido retrasado) O si el cliente tiene la etiqueta VIP en Bind.  
  * **Prioridad ALTA (Naranja):** Se asigna si Monto\_Total \> UMBRAL\_MONTO.  
  * **Prioridad NORMAL (Verde/Azul):** Resto de los pedidos.  
* **Parametrización:**  
  * El valor UMBRAL\_MONTO no debe estar "harcodeado" (fijo en código). Debe existir una variable de configuración en la base de datos (Default: $50,000 MXN) editable por el usuario Administrador.  
* **Visualización:** Indicadores visuales claros (iconos de fuego, colores de fila) en todos los tableros de control.

### **RF-03: Asignación de Recursos y Gestión de Flota**

**Descripción:** Herramientas para que el Jefe de Tráfico asigne responsables de entrega, validando la capacidad operativa.

* **Funcionalidad:** Interfaz "Drag & Drop" o selección múltiple para mover pedidos de la lista de pendientes a la "cubeta" de un chofer específico.  
* **Resiliencia Geográfica (Corrección Manual):**  
  * Capacidad para que el usuario arrastre y corrija manualmente la ubicación del pin en el mapa si la geocodificación automática de Google Maps es imprecisa o coloca la dirección en un punto incorrecto.  
* **Validación de Capacidad:**  
  * El sistema mantendrá un contador de pedidos asignados por chofer por día.  
  * **Alerta Suave:** Si se intenta asignar más de 15 pedidos a un chofer, el sistema mostrará: *"Advertencia: El chofer ha superado la carga recomendada. ¿Desea continuar?"*.

### **RF-04: Manifiesto Digital y Prueba de Entrega (POD)**

**Descripción:** Aplicación móvil (Web App Responsiva) para el chofer que reemplaza las hojas de papel.

* **Arquitectura Offline-First:**  
  * La aplicación debe ser capaz de operar en zonas sin cobertura (sótanos, carreteras). Los datos de entrega (firmas, fotos, cambios de estatus) deben guardarse localmente y sincronizarse automáticamente cuando el dispositivo recupere la conexión.  
* **Hoja de Ruta:** Lista ordenada de paradas con botones de acción rápida ("Navegar con Maps", "Llamar").  
* **Prueba de Entrega (Proof of Delivery \- POD):**  
  * Al marcar "Entregar", el sistema debe exigir evidencia.  
  * **Opciones:** Captura de Firma digital en pantalla O Captura de Fotografía del paquete en el domicilio (obligatorio si no hay quien firme).  
  * Esta evidencia se adjunta al registro del envío y es visible para Ventas y Dirección.

### **RF-05: Encuesta de Satisfacción Transaccional (CSAT)**

**Descripción:** Medición inmediata de la calidad del servicio de entrega.

* **Metodología:** Se utilizará **CSAT (Customer Satisfaction Score)** basado en estrellas (1 a 5), ya que es el estándar para evaluar transacciones puntuales como una entrega. (A diferencia del NPS que mide lealtad a la marca a largo plazo).  
* **Flujo:**  
  * El correo de confirmación de entrega incluye 5 estrellas interactivas.  
  * Al hacer clic, se registra el voto.  
* **Gestión de Detractores:**  
  * **Alerta Negativa:** Si la calificación es 1 o 2 estrellas, el sistema debe disparar una notificación inmediata por correo al Gerente de Operaciones para seguimiento proactivo ("Ticket de Rescate").

### **RF-09: Portal de Visibilidad para Ventas**

**Descripción:** Módulo de consulta (solo lectura) para que los vendedores autogestionen el seguimiento de sus pedidos.

* **Filtros Inteligentes:** Vista predeterminada "Mis Pedidos" (basado en el usuario logueado).  
* **Buscador Global:** Búsqueda por Cliente, RFC o Número de Orden.  
* **Línea de Tiempo:** Visualización gráfica del estado del pedido: Recibido \-\> Preparación \-\> En Ruta \-\> Entregado.  
* **Reseña Interna:** Capacidad para que el vendedor deje notas internas sobre la entrega (ej. "Cliente reportó caja maltratada") que alimentan los reportes de calidad operativa.

### **RF-12: Notificación Proactiva de "Pedido en Camino" con ETA**

**Objetivo:** Informar al cliente que su pedido ha salido del almacén y proporcionar una ventana de tiempo estimada de llegada, reduciendo drásticamente las entregas fallidas por ausencia del receptor.

* **Disparador Técnico (Trigger):**  
  * Se activa mediante un **Background Job (Proceso Asíncrono)** en el momento en que el Jefe de Tráfico cambia el estatus de un grupo de pedidos a EN\_RUTA (Despacho confirmado).  
  * *Nota Técnica:* El envío de correos no debe bloquear la interfaz de usuario. Debe procesarse en segundo plano (cola de tareas).  
* **Fuente de Datos de Contacto:**  
  * El sistema utilizará el correo electrónico del campo Client.ContactEmail importado de Bind ERP. Si no existe, se intentará usar el correo de facturación.  
  * **Gestión de Rebotes:** Si el correo falla (Bounce), se debe generar una alerta en el tablero de Tráfico para realizar contacto telefónico.  
* **Algoritmo de Cálculo de ETA (Hora Estimada de Llegada):**  
  * El sistema calculará la hora estimada basándose en la secuencia de paradas definida en la ruta.  
  * **Fórmula:** Hora\_Inicio\_Ruta \+ (Posición\_Secuencial \* Tiempo\_Promedio\_Parada) \+ Buffer\_Transito.  
  * **Parámetros Configurables:**  
    * Hora\_Inicio\_Ruta: Default 9:00 AM (Configurable por día).  
    * Tiempo\_Promedio\_Parada: Default 30 min (Configurable en Ajustes Generales, incluye tiempo de descarga).  
    * Buffer\_Transito: Factor de seguridad (ej. \+15%) para imprevistos de tráfico.  
  * *Ejemplo:*  
    * Parada 1: 9:00 AM \+ (0 \* 30m) \= 9:00 AM (ETA: 9:00 \- 9:30).  
    * Parada 4: 9:00 AM \+ (3 \* 30m) \= 10:30 AM (ETA: 10:30 \- 11:00).  
* **Seguridad en el Rastreo:**  
  * El correo incluirá un botón "Ver Estatus en Tiempo Real".  
  * Este enlace debe apuntar a una URL pública segura que utilice un **Token Hash único** (ej. UUID o HMAC) para identificar el pedido.  
  * *Seguridad:* No se debe usar el ID secuencial del pedido (ej. pedido\_id=100) en la URL pública.  
  * **Caducidad:** El enlace público debe expirar automáticamente 24 horas después de que el pedido ha sido marcado como "Entregado" para proteger la privacidad del cliente.  
* **Contenido del Correo (Plantilla HTML Responsiva):**  
  * **Asunto:** "🚀 ¡Tu pedido SCRAM va en camino\!"  
  * **Header:** Logo de la empresa y saludo personalizado.  
  * **Cuerpo Principal:**  
    * "Hola \[Nombre Cliente\], buenas noticias: tu pedido ha salido de nuestro almacén."  
    * "Tu chofer asignado es: \[Nombre Chofer\]."  
    * **Bloque Destacado:** "Hora Estimada de Llegada: **\[Rango de Hora Calculado\]**".  
    * "Por favor, asegúrate de que haya alguien disponible para recibir el paquete."  
  * **Footer:** Enlaces de soporte y botón de rastreo seguro.

## **4\. Matriz de Roles y Seguridad**

La segregación de funciones es crítica para la seguridad de la información y la eficiencia operativa.

| Rol | Usuario Tipo | Permisos Clave (Whitelist) | Restricciones (Blacklist) |
| :---- | :---- | :---- | :---- |
| **1\. Analista de Compras** | Noemi | • Sincronizar con Bind ERP • Validar existencia física • Liberar pedidos a Tráfico | • NO puede ver/modificar Rutas • NO puede asignar Choferes |
| **2\. Jefe de Tráfico (ADMIN)** | Karla | • Visualizar Mapa de Rutas • Asignar/Reasignar Choferes • Iniciar Despacho (Trigger correos) • Gestión de Usuarios | • NO puede sincronizar (evitar basura) • NO puede editar montos financieros |
| **3\. Chofer Operativo** | Soporte/Juan | • App Móvil (Solo su ruta) • Botones de acción (Maps, Llamar) • Captura de Evidencia (POD) | • **NO ve montos ($)** (Seguridad) • NO ve rutas de otros • NO ve historial pasado |
| **4\. Ventas / Comercial** | Vendedores | • Consultar Estatus (Solo lectura) • Crear Reseña Interna • Ver Evidencia de Entrega | • Acceso de SOLO LECTURA • Sin permisos de edición operativa |
| **5\. Dirección** | Gerencia | • Dashboard Global de KPIs • Reportes Financieros | • Solo Lectura |

## **5\. Casos de Uso Detallados (Escenarios Operativos)**

### **CU-06: Despacho de Ruta y Alerta Masiva**

Actor: Jefe de Tráfico (Karla).  
Precondición: Ha agrupado 5 pedidos en el mapa y asignado al Chofer Juan.  
Flujo Principal:

1. Karla revisa el orden de las paradas en el mapa (1, 2, 3, 4, 5).  
2. Presiona el botón **"Confirmar Despacho / Iniciar Ruta"**.  
3. El sistema cambia el estatus de los 5 pedidos a IN\_TRANSIT.  
4. El sistema calcula los tiempos y **envía 5 correos electrónicos individuales** a cada cliente.  
5. El sistema muestra una confirmación: *"Ruta iniciada. Clientes notificados."*

### **CU-07: Recepción de Alerta (Cliente)**

Actor: Cliente Final.  
Flujo:

1. Recibe notificación en su celular.  
2. Lee: *"Llegamos entre 11:00 y 11:30"*.  
3. Acción: El cliente avisa a su recepción o se prepara para no salir a comer a esa hora.

## **6\. Historias de Usuario**

#### **HU-12: Notificación de Arribo**

**COMO** Cliente, **QUIERO** saber a qué hora aproximada llegará mi pedido, **PARA** organizar mi día y estar disponible para recibir al chofer.

* **Criterio de Aceptación:** El correo debe llegar máximo 5 minutos después de que el chofer sale del almacén. La hora estimada debe tener un margen de error razonable (+/- 30 min).

## **7\. Modelo de Datos Extendido (ERD)**

Se detallan las entidades y campos necesarios para soportar las nuevas funcionalidades de notificación y cálculo de tiempos.

erDiagram  
    ORDER {  
        string bind\_id PK "UUID único del ERP"  
        string client\_email "Sincronizado de Bind"  
        int route\_position "Secuencia en la ruta (1..N)"  
        datetime estimated\_arrival\_start "Inicio Ventana ETA"  
        datetime estimated\_arrival\_end "Fin Ventana ETA"  
        boolean dispatch\_email\_sent "Flag de control"  
        string tracking\_hash "Token de seguridad"  
        datetime tracking\_expires\_at "Caducidad del link"  
        int csat\_score "1-5 Estrellas"  
    }  
      
    SHIPMENT\_EVIDENCE {  
        int evidence\_id PK  
        string order\_id FK  
        string type "SIGNATURE, PHOTO"  
        string url "Ruta al archivo en Storage"  
        datetime created\_at  
        boolean uploaded\_offline "Flag de sincronización"  
    }

    ORDER ||--o{ SHIPMENT\_EVIDENCE : tiene

## **8\. Requerimientos No Funcionales (NFR)**

1. **Rendimiento y Asincronía:** El envío de correos masivos (ej. rutas de 20 paradas) debe procesarse mediante colas de trabajo (Background Jobs).  
2. **Seguridad de Datos:** Los enlaces públicos de rastreo deben utilizar tokens criptográficos (UUID v4 o HMAC) con expiración.  
3. **Disponibilidad y Modo Offline:** El sistema web debe ser 99.9% disponible, pero la App Móvil debe garantizar funcionalidad básica (ver ruta, capturar evidencia) en modo desconectado.  
4. **Auditabilidad:** Todas las acciones críticas (Sincronización, Despacho, Entrega) deben registrarse en un log de auditoría inmutable.

**Fin del Documento MD050 v3.4**