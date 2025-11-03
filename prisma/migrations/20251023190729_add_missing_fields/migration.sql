/*
  Warnings:

  - You are about to drop the column `directDepositDate` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `payrollGeneratedOn` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `stops` on the `Payroll` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Payroll" DROP COLUMN "directDepositDate",
DROP COLUMN "payrollGeneratedOn",
DROP COLUMN "stops";
