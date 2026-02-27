import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteStops1737000000000 implements MigrationInterface {
  name = 'AddRouteStops1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabla pickup_points — Ubicaciones guardadas y reutilizables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pickup_points" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "client_id" uuid,
        "client_name" character varying(200) NOT NULL,
        "contact_name" character varying(200),
        "contact_phone" character varying(20),
        "label" character varying(100),
        "street" character varying(200),
        "number" character varying(20),
        "neighborhood" character varying(100),
        "postal_code" character varying(10),
        "city" character varying(100),
        "state" character varying(100),
        "reference" text,
        "latitude" decimal(10,7),
        "longitude" decimal(10,7),
        "use_count" integer NOT NULL DEFAULT 0,
        "last_used_at" timestamp,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "pk_pickup_points" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pickup_points_client" ON "pickup_points" ("client_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pickup_points_active" ON "pickup_points" ("is_active")
    `);

    // 2. Tabla route_stops — Parada específica en la ruta de un día
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "route_stops" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "stop_type" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "pickup_point_id" uuid,
        "client_id" uuid,
        "client_name" character varying(200) NOT NULL,
        "contact_name" character varying(200),
        "contact_phone" character varying(20),
        "address_raw" jsonb,
        "latitude" decimal(10,7),
        "longitude" decimal(10,7),
        "assigned_driver_id" uuid,
        "route_position" smallint,
        "estimated_arrival_start" timestamp,
        "estimated_arrival_end" timestamp,
        "description" text,
        "items_description" text,
        "completed_at" timestamp,
        "completed_by" uuid,
        "completion_notes" text,
        "completion_photo_key" character varying(500),
        "internal_notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "pk_route_stops" PRIMARY KEY ("id"),
        CONSTRAINT "fk_route_stops_pickup_point" FOREIGN KEY ("pickup_point_id") REFERENCES "pickup_points"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_route_stops_driver" FOREIGN KEY ("assigned_driver_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_route_stops_driver_status" ON "route_stops" ("assigned_driver_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_route_stops_pickup_point" ON "route_stops" ("pickup_point_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_route_stops_status" ON "route_stops" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_route_stops_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_route_stops_pickup_point"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_route_stops_driver_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "route_stops"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pickup_points_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pickup_points_client"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pickup_points"`);
  }
}
