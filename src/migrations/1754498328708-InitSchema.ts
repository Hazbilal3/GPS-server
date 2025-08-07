import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1691302400000 implements MigrationInterface {
  name = 'InitSchema1691302400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "driver" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR NOT NULL
      );
    `);

    await queryRunner.query(`
  CREATE TABLE "delivery" (
    "id" SERIAL PRIMARY KEY,
    "barcode" VARCHAR NOT NULL,
    "sequence_number" INT NOT NULL,
    "address" VARCHAR NOT NULL,
    "event" VARCHAR NOT NULL,
    "timestamp" TIMESTAMP, -- ← remove NOT NULL
    "latitude" FLOAT NOT NULL,
    "longitude" FLOAT NOT NULL,
    "driverId" INT,
    CONSTRAINT "FK_driver_delivery" FOREIGN KEY ("driverId") REFERENCES "driver"("id") ON DELETE CASCADE
  );
`);

    await queryRunner.query(`
  ALTER TABLE "delivery" ALTER COLUMN "timestamp" DROP NOT NULL;
`);

    await queryRunner.query(`
      CREATE TABLE "mismatch" (
        "id" SERIAL PRIMARY KEY,
        "expected_address" VARCHAR NOT NULL,
        "actual_address" VARCHAR NOT NULL,
        "similarity_score" FLOAT NOT NULL,
        "deliveryId" INT,
        CONSTRAINT "FK_delivery_mismatch" FOREIGN KEY ("deliveryId") REFERENCES "delivery"("id") ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "mismatch"`);
    await queryRunner.query(`DROP TABLE "delivery"`);
    await queryRunner.query(`DROP TABLE "driver"`);
  }
}
