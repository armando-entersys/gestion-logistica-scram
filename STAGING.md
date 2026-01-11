# SCRAM - Entorno de Staging

Entorno de pruebas aislado de produccion. No conecta al ERP real (Bind).

## URLs

| Servicio | URL |
|----------|-----|
| Frontend (Panel Admin) | https://staging-gestion-logistica.scram2k.com |
| Mobile PWA (Choferes) | https://staging-app-gestion-logistica.scram2k.com |
| API | https://staging-api-gestion-logistica.scram2k.com |
| Swagger Docs | https://staging-api-gestion-logistica.scram2k.com/api/docs |

## Usuarios de Prueba

**Password para todos:** `scram2026`

| Email | Rol | Permisos |
|-------|-----|----------|
| admin@scram.local | ADMIN | Panel completo, asignar choferes, gestionar usuarios |
| compras@scram.local | PURCHASING | Sincronizar pedidos, validar existencias, liberar pedidos |
| chofer1@scram.local | DRIVER | App movil, ver su ruta, entregar pedidos |
| chofer2@scram.local | DRIVER | App movil, ver su ruta, entregar pedidos |
| ventas1@scram.local | SALES | Solo lectura, consultar estatus de pedidos |
| ventas2@scram.local | SALES | Solo lectura, consultar estatus de pedidos |
| director@scram.local | DIRECTOR | Dashboard KPIs, reportes (solo lectura) |

## Roles y Permisos

### ADMIN (Jefe de Trafico)
- Visualizar mapa de entregas
- Asignar choferes a pedidos
- Iniciar despacho de rutas
- Gestionar usuarios
- Ver todas las estadisticas

### PURCHASING (Analista de Compras)
- Sincronizar pedidos desde Bind (en staging genera datos mock)
- Validar existencia de productos
- Liberar pedidos para entrega
- NO puede asignar choferes

### DRIVER (Chofer)
- Acceso solo a app movil
- Ver unicamente su ruta asignada
- Marcar entregas completadas
- Capturar evidencia (foto/firma)
- NO ve montos de pedidos

### SALES (Ventas)
- Solo lectura
- Consultar estatus de pedidos
- Ver evidencias de entrega
- NO puede modificar nada

### DIRECTOR (Direccion)
- Solo lectura
- Dashboard global de KPIs
- Reportes financieros

## Modo Staging

El entorno de staging tiene las siguientes diferencias con produccion:

1. **Sincronizacion Mock**: Al presionar "Sincronizar desde Bind", se generan 5 pedidos aleatorios de prueba en vez de conectar al ERP real.

2. **Facturas Huerfanas**: La seccion de facturas huerfanas siempre aparece vacia.

3. **Base de Datos Separada**: Los datos de staging estan completamente aislados de produccion.

## Datos de Prueba Iniciales

El entorno incluye datos de prueba precargados:

- 3 clientes de prueba con direcciones
- 8 pedidos en diferentes estados (READY, IN_TRANSIT, DELIVERED, DRAFT)
- Pedidos asignados a chofer1 y chofer2

## Rama Git

```bash
git checkout staging
```

## Despliegue

Para desplegar cambios a staging:

```bash
# En el servidor
cd /srv/scram-apps/gestion-logistica-staging
git pull origin staging
docker compose -f docker-compose.staging.yml up -d --build
```

## Servidor

- **Ubicacion:** `/srv/scram-apps/gestion-logistica-staging`
- **Base de datos:** `scram_staging_db` (PostgreSQL puerto 5435)
- **Redis:** Puerto 6382
