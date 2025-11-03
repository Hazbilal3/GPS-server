/*
  Warnings:

  - You are about to drop the column `month` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `totalDeductions` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `weekInMonth` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `Payroll` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Payroll" DROP COLUMN "month",
DROP COLUMN "totalDeductions",
DROP COLUMN "weekInMonth",
DROP COLUMN "year",
ADD COLUMN     "totalDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;
