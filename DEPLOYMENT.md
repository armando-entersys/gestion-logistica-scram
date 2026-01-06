# Guía de Despliegue - SCRAM Sistema de Gestión Logística

## Información del Servidor

| Concepto | Valor |
|----------|-------|
| Servidor | `prod-server` |
| Zona GCP | `us-central1-c` |
| IP | `34.59.193.54` |
| Ruta del proyecto | `/srv/scram-apps/gestion-logistica` |

## URLs de Producción

- **Frontend Web:** https://gestion-logistica.scram2k.com
- **API Backend:** https://api-gestion-logistica.scram2k.com
- **Mobile PWA:** https://app-gestion-logistica.scram2k.com
- **API Docs (Swagger):** https://api-gestion-logistica.scram2k.com/api/docs

## Proceso de Despliegue

### 1. Hacer commit y push de los cambios locales

```bash
git add .
git commit -m "descripción de los cambios"
git push origin main
```

### 2. Conectar al servidor via SSH

```bash
gcloud compute ssh prod-server --zone=us-central1-c
```

### 3. Ir al directorio del proyecto y hacer pull

```bash
cd /srv/scram-apps/gestion-logistica
git pull origin main
```

### 4. Reconstruir y reiniciar los contenedores

```bash
# Reconstruir imágenes con los nuevos cambios
sudo docker compose build

# Reiniciar servicios (sin downtime para DB y Redis)
sudo docker compose up -d
```

### 5. Verificar que los servicios estén corriendo

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep scram-logistica
```

Todos los servicios deben mostrar estado "Up" y "healthy":
- `scram-logistica-db` - PostgreSQL
- `scram-logistica-redis` - Redis
- `scram-logistica-api` - Backend NestJS
- `scram-logistica-worker` - Worker BullMQ
- `scram-logistica-web` - Frontend Next.js
- `scram-logistica-mobile` - Mobile PWA

### 6. Verificar logs si hay problemas

```bash
# Ver logs de la API
docker logs scram-logistica-api --tail 50

# Ver logs en tiempo real
docker logs -f scram-logistica-api

# Buscar errores específicos
docker logs scram-logistica-api 2>&1 | grep -i error
```

## Comandos de Despliegue Rápido (One-liner desde Windows)

```bash
# Push local + deploy remoto
git push origin main && gcloud compute ssh prod-server --zone=us-central1-c --command="cd /srv/scram-apps/gestion-logistica && git pull && sudo docker compose build && sudo docker compose up -d"
```

## Migraciones de Base de Datos

Si se agregan nuevas columnas a las entidades, ejecutar manualmente:

```bash
# Conectar a PostgreSQL
docker exec -it scram-logistica-db psql -U scram_logistica_user -d scram_logistica_db

# Ejemplo: agregar columnas
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nueva_columna VARCHAR(100);
```

**Importante:** Después de cambios en el esquema de BD, reiniciar la API:
```bash
docker restart scram-logistica-api
```

## Estructura de Volúmenes Docker

Los datos persistentes están en volúmenes externos:

| Volumen | Contenido |
|---------|-----------|
| `scram-apps_pg_data` | Datos PostgreSQL |
| `scram-apps_redis_data` | Datos Redis |

**NUNCA eliminar estos volúmenes** - contienen todos los datos de producción.

## Archivo de Configuración (.env)

Ubicación: `/srv/scram-apps/gestion-logistica/.env`

Variables requeridas:
```env
# Database
DB_USER=scram_logistica_user
DB_PASSWORD=<password>
DB_NAME=scram_logistica_db

# JWT
JWT_SECRET=<secret>
JWT_EXPIRATION=1d

# APIs externas (opcional)
BIND_API_URL=
BIND_API_KEY=
GOOGLE_MAPS_API_KEY=
SENDGRID_API_KEY=

# Email
EMAIL_FROM=notificaciones@scram2k.com
OPERATIONS_ALERT_EMAIL=operaciones@scram2k.com
```

## Troubleshooting

### Error: "column X does not exist"
La entidad tiene columnas que no existen en la BD. Agregar manualmente:
```bash
docker exec scram-logistica-db psql -U scram_logistica_user -d scram_logistica_db -c "ALTER TABLE tabla ADD COLUMN IF NOT EXISTS columna TIPO;"
docker restart scram-logistica-api
```

### Error: "password authentication failed"
Verificar que el `.env` tenga la contraseña correcta. Si se perdió:
```bash
# Detener servicios
sudo docker compose down

# Iniciar postgres con trust auth
docker run -d --name temp-pg -v scram-apps_pg_data:/var/lib/postgresql/data -e POSTGRES_HOST_AUTH_METHOD=trust postgis/postgis:16-3.4-alpine
sleep 5

# Cambiar contraseña
docker exec temp-pg psql -U scram_logistica_user -d scram_logistica_db -c "ALTER USER scram_logistica_user WITH PASSWORD 'nueva_password';"

# Limpiar y reiniciar
docker stop temp-pg && docker rm temp-pg
# Actualizar .env con la nueva contraseña
sudo docker compose up -d
```

### Ver estado de contenedores
```bash
docker ps -a | grep scram-logistica
```

### Reiniciar un servicio específico
```bash
docker restart scram-logistica-api
docker restart scram-logistica-web
```

### Reconstruir solo un servicio
```bash
sudo docker compose build api
sudo docker compose up -d api
```

## Red y Proxy Inverso

El sistema usa **Traefik** como proxy inverso con certificados SSL automáticos de Let's Encrypt.

La red `traefik` es externa y compartida con otros servicios del servidor.

## Contacto

- **Dominio:** scram2k.com
- **Proyecto GCP:** mi-infraestructura-web
