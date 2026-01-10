import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddressChangeRequests1736550000000 implements MigrationInterface {
  name = 'AddAddressChangeRequests1736550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type
    await queryRunner.query(`
      CREATE TYPE "address_change_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED')
    `);

    // Create address_change_requests table
    await queryRunner.query(`
      CREATE TABLE "address_change_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "requested_by_id" uuid NOT NULL,
        "driver_id" uuid NOT NULL,
        "old_address" jsonb NOT NULL,
        "new_address" jsonb NOT NULL,
        "status" "address_change_status_enum" NOT NULL DEFAULT 'PENDING',
        "rejection_reason" text,
        "responded_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_address_change_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_address_change_requests_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_address_change_requests_requested_by" FOREIGN KEY ("requested_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_address_change_requests_driver" FOREIGN KEY ("driver_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Create index for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_address_change_requests_driver_status"
      ON "address_change_requests" ("driver_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_address_change_requests_order"
      ON "address_change_requests" ("order_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_address_change_requests_order"`);
    await queryRunner.query(`DROP INDEX "IDX_address_change_requests_driver_status"`);
    await queryRunner.query(`DROP TABLE "address_change_requests"`);
    await queryRunner.query(`DROP TYPE "address_change_status_enum"`);
  }
}
