/*
  Warnings:

  - A unique constraint covering the columns `[driverId,weekNumber]` on the table `Payroll` will be added. If there are existing duplicate values, this will fail.
  - Made the column `weekNumber` on table `Payroll` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Payroll" ALTER COLUMN "weekNumber" SET NOT NULL,
ALTER COLUMN "netPay" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_driverId_weekNumber_key" ON "public"."Payroll"("driverId", "weekNumber");
