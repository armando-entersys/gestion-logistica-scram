import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientAddresses1736300000000 implements MigrationInterface {
  name = 'AddClientAddresses1736300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create client_addresses table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client_addresses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "client_number" character varying(50) NOT NULL,
        "label" character varying(100),
        "street" character varying(200),
        "number" character varying(20),
        "neighborhood" character varying(100),
        "postal_code" character varying(10),
        "city" character varying(100),
        "state" character varying(100),
        "reference" text,
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "is_default" boolean NOT NULL DEFAULT false,
        "source" character varying(20) NOT NULL DEFAULT 'MANUAL',
        "bind_source_id" character varying(50),
        "use_count" integer NOT NULL DEFAULT 0,
        "last_used_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_client_addresses_id" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_client_addresses_client" ON "client_addresses" ("client_number")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_client_addresses_postal" ON "client_addresses" ("postal_code")
    `);

    // Populate from existing orders (extract unique addresses per client)
    await queryRunner.query(`
      INSERT INTO "client_addresses" (
        "client_number", "street", "number", "neighborhood",
        "postal_code", "city", "state", "reference",
        "latitude", "longitude", "source", "bind_source_id", "is_default"
      )
      SELECT DISTINCT ON (o.client_number, COALESCE(o.address_raw->>'street', ''), COALESCE(o.address_raw->>'postalCode', ''))
        o.client_number,
        o.address_raw->>'street',
        o.address_raw->>'number',
        o.address_raw->>'neighborhood',
        o.address_raw->>'postalCode',
        o.address_raw->>'city',
        o.address_raw->>'state',
        o.address_raw->>'reference',
        o.latitude,
        o.longitude,
        'SYNC',
        o.bind_id,
        true
      FROM orders o
      WHERE o.client_number IS NOT NULL
        AND o.client_number != ''
        AND o.address_raw->>'street' IS NOT NULL
        AND o.address_raw->>'street' != ''
      ORDER BY o.client_number, COALESCE(o.address_raw->>'street', ''), COALESCE(o.address_raw->>'postalCode', ''), o.created_at DESC
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "client_addresses"`);
  }
}
