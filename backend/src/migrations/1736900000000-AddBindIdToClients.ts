import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBindIdToClients1736900000000 implements MigrationInterface {
  name = 'AddBindIdToClients1736900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
      ADD COLUMN IF NOT EXISTS "bind_id" character varying(50)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_clients_bind_id" ON "clients" ("bind_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_clients_bind_id"`);
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN IF EXISTS "bind_id"`);
  }
}
