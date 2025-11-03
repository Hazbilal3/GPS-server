/*
  Warnings:

  - You are about to drop the column `rate` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `stopRate` on the `Payroll` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Payroll" DROP COLUMN "rate",
DROP COLUMN "stopRate";

-- CreateTable
CREATE TABLE "public"."AirtablePayroll" (
    "id" SERIAL NOT NULL,
    "payrollGeneratedOn" TIMESTAMP(3) NOT NULL,
    "payPeriod" TEXT NOT NULL,
    "directDepositDate" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "driver" TEXT[],
    "stops" TEXT[],
    "totalFromStops" DOUBLE PRECISION NOT NULL,
    "totalBonus" DOUBLE PRECISION NOT NULL,
    "totalDeductions" DOUBLE PRECISION NOT NULL,
    "netPay" DOUBLE PRECISION NOT NULL,
    "driverName" TEXT NOT NULL,
    "payrollSummary" TEXT[],
    "totalStopsCompleted" INTEGER NOT NULL,
    "salaryType" TEXT[],
    "subtotal" DOUBLE PRECISION NOT NULL,
    "created" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AirtablePayroll_pkey" PRIMARY KEY ("id")
);
