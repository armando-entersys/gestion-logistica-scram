import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushSubscriptions1736560000000 implements MigrationInterface {
  name = 'AddPushSubscriptions1736560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "endpoint" varchar(500) NOT NULL,
        "p256dh" varchar(500) NOT NULL,
        "auth" varchar(500) NOT NULL,
        "user_agent" varchar(500),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_push_subscriptions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_push_subscriptions_user_id" ON "push_subscriptions" ("user_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_push_subscriptions_user_endpoint" ON "push_subscriptions" ("user_id", "endpoint")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_push_subscriptions_user_endpoint"`);
    await queryRunner.query(`DROP INDEX "IDX_push_subscriptions_user_id"`);
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}
