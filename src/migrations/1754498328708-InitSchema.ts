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
        "address" VARCHAR NOT NULL,
        "gpsLocation" VARCHAR,
        "expectedLat" FLOAT,
        "expectedLng" FLOAT,
        "distanceKm" FLOAT,
        "status" VARCHAR,
        "googleMapsLink" VARCHAR,
        "latitude" FLOAT,
        "longitude" FLOAT,
        "driverId" INT,
        CONSTRAINT "FK_driver_delivery" FOREIGN KEY ("driverId") REFERENCES "driver"("id") ON DELETE CASCADE
      );
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

    await queryRunner.query(`
      CREATE TABLE "user" (
        "id" SERIAL PRIMARY KEY,
        "driverId" INT,
        "firstname" VARCHAR NOT NULL,
        "lastname" VARCHAR NOT NULL,
        "email" VARCHAR NOT NULL UNIQUE,
        "password" VARCHAR NOT NULL,
        "userRole" INT NOT NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "mismatch"`);
    await queryRunner.query(`DROP TABLE "delivery"`);
    await queryRunner.query(`DROP TABLE "driver"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}