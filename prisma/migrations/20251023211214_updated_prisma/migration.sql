/*
  Warnings:

  - You are about to drop the column `directDepositDate` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `netPay` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `payrollGeneratedOn` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `payrollSummary` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `stops` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `subtotal` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `totalBonus` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `totalDeductions` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `totalFromStops` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `totalStopsCompleted` on the `Payroll` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Payroll" DROP COLUMN "directDepositDate",
DROP COLUMN "netPay",
DROP COLUMN "payrollGeneratedOn",
DROP COLUMN "payrollSummary",
DROP COLUMN "stops",
DROP COLUMN "subtotal",
DROP COLUMN "totalBonus",
DROP COLUMN "totalDeductions",
DROP COLUMN "totalFromStops",
DROP COLUMN "totalStopsCompleted";
