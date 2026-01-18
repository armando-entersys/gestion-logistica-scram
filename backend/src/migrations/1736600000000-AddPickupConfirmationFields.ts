import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPickupConfirmationFields1736600000000
  implements MigrationInterface
{
  name = 'AddPickupConfirmationFields1736600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add pickup confirmation fields
    await queryRunner.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS pickup_confirmed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS pickup_confirmed_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS pickup_has_issue BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS pickup_issue_notes TEXT,
      ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS en_route_email_sent BOOLEAN DEFAULT false
    `);

    // Add index for pickup confirmation queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_pickup_confirmed
      ON orders (pickup_confirmed_at)
      WHERE pickup_confirmed_at IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_orders_pickup_confirmed
    `);

    await queryRunner.query(`
      ALTER TABLE orders
      DROP COLUMN IF EXISTS pickup_confirmed_at,
      DROP COLUMN IF EXISTS pickup_confirmed_by,
      DROP COLUMN IF EXISTS pickup_has_issue,
      DROP COLUMN IF EXISTS pickup_issue_notes,
      DROP COLUMN IF EXISTS en_route_at,
      DROP COLUMN IF EXISTS en_route_email_sent
    `);
  }
}
