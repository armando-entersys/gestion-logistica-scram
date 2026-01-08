import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClients1736400000000 implements MigrationInterface {
  name = 'AddClients1736400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create clients table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "client_number" character varying(50) NOT NULL,
        "name" character varying(200) NOT NULL,
        "email" character varying(150),
        "phone" character varying(20),
        "rfc" character varying(15),
        "category" character varying(50),
        "notes" text,
        "is_vip" boolean NOT NULL DEFAULT false,
        "total_orders" integer NOT NULL DEFAULT 0,
        "total_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "last_order_at" timestamp,
        "bind_source" character varying(20) NOT NULL DEFAULT 'SYNC',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clients_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_clients_client_number" UNIQUE ("client_number")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_clients_rfc" ON "clients" ("rfc")
    `);

    // Add client_id column to client_addresses
    await queryRunner.query(`
      ALTER TABLE "client_addresses"
      ADD COLUMN IF NOT EXISTS "client_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_client_addresses_client_id" ON "client_addresses" ("client_id")
    `);

    // Populate clients from existing orders (unique by client_number)
    await queryRunner.query(`
      INSERT INTO "clients" (
        "client_number", "name", "email", "phone", "rfc", "is_vip",
        "total_orders", "total_amount", "last_order_at", "bind_source"
      )
      SELECT
        o.client_number,
        MAX(o.client_name) as name,
        MAX(o.client_email) as email,
        MAX(o.client_phone) as phone,
        MAX(o.client_rfc) as rfc,
        BOOL_OR(o.is_vip) as is_vip,
        COUNT(*) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_amount,
        MAX(o.created_at) as last_order_at,
        'SYNC'
      FROM orders o
      WHERE o.client_number IS NOT NULL
        AND o.client_number != ''
      GROUP BY o.client_number
    `);

    // Update client_addresses to link to clients
    await queryRunner.query(`
      UPDATE "client_addresses" ca
      SET "client_id" = c.id
      FROM "clients" c
      WHERE ca.client_number = c.client_number
    `);

    // Add foreign key constraint (optional, allows orphan addresses)
    await queryRunner.query(`
      ALTER TABLE "client_addresses"
      ADD CONSTRAINT "FK_client_addresses_client"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "client_addresses" DROP CONSTRAINT IF EXISTS "FK_client_addresses_client"`);
    await queryRunner.query(`ALTER TABLE "client_addresses" DROP COLUMN IF EXISTS "client_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clients"`);
  }
}
