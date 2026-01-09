import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBindClientIdToOrders1736500000000 implements MigrationInterface {
  name = 'AddBindClientIdToOrders1736500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add bind_client_id column to orders table
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "bind_client_id" VARCHAR(50) NULL
    `);

    // Add comment to explain the column
    await queryRunner.query(`
      COMMENT ON COLUMN "orders"."bind_client_id" IS 'UUID del cliente en Bind ERP (para sincronizar direcciones)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "bind_client_id"
    `);
  }
}
