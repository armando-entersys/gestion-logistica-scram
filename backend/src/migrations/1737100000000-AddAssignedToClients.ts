import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add bind_employee_name to users table.
 * This field links system users to their Bind ERP employee name,
 * so SALES users only see orders/clients assigned to their Bind vendedor.
 */
export class AddAssignedToClients1737100000000 implements MigrationInterface {
  name = 'AddAssignedToClients1737100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "bind_employee_name" varchar(100) NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."bind_employee_name" IS 'Nombre del vendedor en Bind ERP para vincular pedidos'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "bind_employee_name"`);
  }
}
