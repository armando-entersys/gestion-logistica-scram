import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704153600000 implements MigrationInterface {
  name = 'InitialSchema1704153600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(100) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL,
        "role_code" character varying(20) NOT NULL DEFAULT 'SALES',
        "phone" character varying(20),
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "CHK_users_role" CHECK (role_code IN ('ADMIN', 'PURCHASING', 'DRIVER', 'SALES', 'DIRECTOR'))
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_users_email" ON "users" ("email")`);

    // Create orders table
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bind_id" character varying(50) NOT NULL,
        "client_name" character varying(200) NOT NULL,
        "client_email" character varying(150) NOT NULL,
        "client_phone" character varying(20),
        "client_rfc" character varying(15),
        "address_raw" jsonb NOT NULL,
        "address_geo" geography(Point, 4326),
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "status" character varying(20) NOT NULL DEFAULT 'DRAFT',
        "priority_level" smallint NOT NULL DEFAULT 1,
        "total_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "is_vip" boolean NOT NULL DEFAULT false,
        "promised_date" date,
        "route_position" smallint,
        "estimated_arrival_start" TIMESTAMP,
        "estimated_arrival_end" TIMESTAMP,
        "tracking_hash" character varying(64),
        "tracking_expires_at" TIMESTAMP,
        "dispatch_email_sent" boolean NOT NULL DEFAULT false,
        "delivery_email_sent" boolean NOT NULL DEFAULT false,
        "csat_score" smallint,
        "csat_feedback" text,
        "internal_notes" text,
        "delivered_at" TIMESTAMP,
        "assigned_driver_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_orders_bind_id" UNIQUE ("bind_id"),
        CONSTRAINT "UQ_orders_tracking_hash" UNIQUE ("tracking_hash"),
        CONSTRAINT "FK_orders_driver" FOREIGN KEY ("assigned_driver_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_orders_bind_id" ON "orders" ("bind_id")`);
    await queryRunner.query(`CREATE INDEX "idx_orders_dashboard" ON "orders" ("status", "priority_level" DESC)`);
    await queryRunner.query(`CREATE INDEX "idx_orders_geo" ON "orders" USING GIST ("address_geo")`);
    await queryRunner.query(`CREATE INDEX "idx_tracking_active" ON "orders" ("tracking_hash") WHERE status = 'IN_TRANSIT'`);

    // Create shipment_evidence table
    await queryRunner.query(`
      CREATE TABLE "shipment_evidence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "type" character varying(20) NOT NULL,
        "storage_key" character varying(255) NOT NULL,
        "is_offline_upload" boolean NOT NULL DEFAULT false,
        "captured_at" TIMESTAMP,
        "captured_latitude" numeric(10,7),
        "captured_longitude" numeric(10,7),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_evidence_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_evidence_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_evidence_type" CHECK (type IN ('PHOTO', 'SIGNATURE'))
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_evidence_order" ON "shipment_evidence" ("order_id")`);

    // Create audit_log table (NFR-4: Auditabilidad)
    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entity_type" character varying(50) NOT NULL,
        "entity_id" uuid NOT NULL,
        "action" character varying(50) NOT NULL,
        "user_id" uuid,
        "old_values" jsonb,
        "new_values" jsonb,
        "ip_address" character varying(45),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_log_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_audit_entity" ON "audit_log" ("entity_type", "entity_id")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_date" ON "audit_log" ("created_at" DESC)`);

    // Create system_config table (RF-02: Parametrización)
    await queryRunner.query(`
      CREATE TABLE "system_config" (
        "key" character varying(100) NOT NULL,
        "value" text NOT NULL,
        "description" text,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_config_key" PRIMARY KEY ("key")
      )
    `);

    // Insert default configuration values
    await queryRunner.query(`
      INSERT INTO "system_config" ("key", "value", "description") VALUES
        ('PRIORITY_THRESHOLD_AMOUNT', '50000', 'Monto umbral para prioridad ALTA (en MXN)'),
        ('DEFAULT_ROUTE_START_TIME', '09:00', 'Hora de inicio de ruta por defecto'),
        ('AVERAGE_STOP_TIME_MINUTES', '30', 'Tiempo promedio por parada (minutos)'),
        ('TRAFFIC_BUFFER_PERCENT', '15', 'Buffer de tráfico para ETA (%)'),
        ('MAX_ORDERS_PER_DRIVER', '15', 'Máximo de pedidos recomendados por chofer')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "system_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shipment_evidence"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
