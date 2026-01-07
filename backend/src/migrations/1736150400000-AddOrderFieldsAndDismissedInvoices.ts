import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderFieldsAndDismissedInvoices1736150400000 implements MigrationInterface {
  name = 'AddOrderFieldsAndDismissedInvoices1736150400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to orders table (if they don't exist)
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "order_number" character varying(50),
      ADD COLUMN IF NOT EXISTS "warehouse_name" character varying(100),
      ADD COLUMN IF NOT EXISTS "employee_name" character varying(100),
      ADD COLUMN IF NOT EXISTS "client_number" character varying(50),
      ADD COLUMN IF NOT EXISTS "purchase_order" character varying(100),
      ADD COLUMN IF NOT EXISTS "carrier_type" character varying(20) DEFAULT 'INTERNAL',
      ADD COLUMN IF NOT EXISTS "carrier_name" character varying(100),
      ADD COLUMN IF NOT EXISTS "carrier_tracking_number" character varying(100)
    `);

    // Create dismissed_invoices table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dismissed_invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bind_invoice_id" character varying(50) NOT NULL,
        "invoice_number" character varying(50) NOT NULL,
        "client_name" character varying(200) NOT NULL,
        "total" numeric(12,2) NOT NULL,
        "reason" text,
        "dismissed_by_id" uuid NOT NULL,
        "dismissed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dismissed_invoices_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_dismissed_invoices_bind_id" UNIQUE ("bind_invoice_id"),
        CONSTRAINT "FK_dismissed_invoices_user" FOREIGN KEY ("dismissed_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_dismissed_invoices_bind_id" ON "dismissed_invoices" ("bind_invoice_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dismissed_invoices"`);

    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "order_number",
      DROP COLUMN IF EXISTS "warehouse_name",
      DROP COLUMN IF EXISTS "employee_name",
      DROP COLUMN IF EXISTS "client_number",
      DROP COLUMN IF EXISTS "purchase_order",
      DROP COLUMN IF EXISTS "carrier_type",
      DROP COLUMN IF EXISTS "carrier_name",
      DROP COLUMN IF EXISTS "carrier_tracking_number"
    `);
  }
}
