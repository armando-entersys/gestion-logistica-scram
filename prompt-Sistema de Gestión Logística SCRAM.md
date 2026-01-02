{
  "project_name": "SCRAM - Sistema de Gestión Logística",
  "role_definition": "Senior Full-Stack Engineer & DevOps Lead (NestJS, Next.js, Docker, PostgreSQL)",
  "objective": "Generar el código fuente completo (scaffolding) para el sistema SCRAM, listo para producción en el servidor EnterSys.",
  "context": {
    "infrastructure": {
      "host": "prod-server (Google Cloud e2-standard-2)",
      "resources": {
        "cpu": "2 vCPUs (Burstable)",
        "ram": "3.3 GB Available",
        "strategy": "No CPU/RAM limits on containers (Vertical Scaling)"
      },
      "network": {
        "proxy": "Traefik v2.10",
        "external_net": "traefik-public",
        "internal_net": "bridge",
        "domains": {
          "api": "api-scram.entersys.mx",
          "web": "scram.entersys.mx"
        },
        "ports": {
          "postgres_host": 5434,
          "redis_host": 6381
        }
      }
    },
    "tech_stack": {
      "backend": "NestJS (Modular Monolith)",
      "frontend_web": "Next.js 14 (App Router, TailwindCSS)",
      "frontend_mobile": "Vite React PWA (Offline-First via Dexie.js)",
      "database": "PostgreSQL 16 + PostGIS",
      "queue": "Redis + BullMQ"
    }
  },
  "instructions": {
    "general": "Generate production-ready code files. Do not use pseudo-code. Ensure all imports are valid.",
    "files_to_generate": [
      {
        "path": "docker-compose.yml",
        "description": "Orchestration file aligning with EnterSys infrastructure constraints.",
        "requirements": [
          "Use postgres:16-alpine and redis:7-alpine",
          "Map ports 5434:5432 and 6381:6379",
          "Define 'traefik-public' as external network",
          "Configure Traefik labels for both API and Web services",
          "Include healthchecks for API (curl -f http://localhost:3000/health)"
        ]
      },
      {
        "path": "backend/src/orders/entities/order.entity.ts",
        "description": "TypeORM entity definition for the core Order model.",
        "requirements": [
          "Primary Key: UUID",
          "Column: bind_id (Unique, String)",
          "Column: status (Enum: DRAFT, READY, IN_TRANSIT, DELIVERED)",
          "Column: priority_level (Int)",
          "Column: address_raw (JSONB)",
          "Column: location (Geometry Point, SRID 4326)",
          "Indexes on status and bind_id"
        ]
      },
      {
        "path": "backend/src/orders/orders.service.ts",
        "description": "Business logic for Orders module.",
        "requirements": [
          "Method syncWithBind(): Implements upsert logic using bind_id",
          "Method dispatchRoute(driverId, orderIds[]): Updates status to IN_TRANSIT and injects job into 'email-queue'"
        ]
      },
      {
        "path": "backend/src/worker/email.processor.ts",
        "description": "BullMQ Processor for async notifications.",
        "requirements": [
          "Process job 'send-eta-email'",
          "Calculate ETA: Date.now() + (30 mins * stop_sequence_number)",
          "Simulate sending email via console.log or placeholder service"
        ]
      },
      {
        "path": "frontend/src/app/planning/page.tsx",
        "description": "Next.js page for the Traffic Manager Cockpit.",
        "requirements": [
          "Layout: 2 Columns (Order List Left, Map Right)",
          "State: Use Zustand store for selected orders",
          "Action: 'Dispatch' button calling PATCH /orders/dispatch",
          "Map: Placeholder div with text 'Interactive Map'"
        ]
      },
      {
        "path": "mobile/src/lib/db.ts",
        "description": "Dexie.js configuration for Offline-First capability.",
        "requirements": [
          "Define schema: 'orders', 'pending_sync'",
          "Export typed Dexie instance"
        ]
      },
      {
        "path": "mobile/src/hooks/useSync.ts",
        "description": "React Hook for background synchronization.",
        "requirements": [
          "Listen to 'online' window event",
          "Iterate over 'pending_sync' table",
          "POST data to backend API",
          "Clear table on success"
        ]
      }
    ]
  },
  "output_format": "Markdown code blocks with file paths as titles."
}