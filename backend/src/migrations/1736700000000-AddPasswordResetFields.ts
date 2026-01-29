import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetFields1736700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS reset_token,
      DROP COLUMN IF EXISTS reset_token_expires
    `);
  }
}
