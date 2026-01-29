import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderStatusValues1736800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't have a simple way to add enum values
    // The order status is stored as VARCHAR, so we don't need to alter the enum type
    // Just ensure the column accepts the new values (which it does since it's VARCHAR(20))

    // Optional: Add index for the new statuses if querying them frequently
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status_returned ON orders(status) WHERE status = 'RETURNED_TO_PURCHASING'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status_cancelled ON orders(status) WHERE status = 'CANCELLED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_status_returned`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_status_cancelled`);
  }
}
