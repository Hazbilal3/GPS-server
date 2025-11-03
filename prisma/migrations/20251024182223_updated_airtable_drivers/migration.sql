/*
  Warnings:

  - You are about to drop the column `createdAt` on the `AirtablePayroll` table. All the data in the column will be lost.
  - The `directDepositDate` column on the `AirtablePayroll` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `stops` column on the `AirtablePayroll` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."AirtablePayroll" DROP COLUMN "createdAt",
ALTER COLUMN "payrollGeneratedOn" DROP NOT NULL,
ALTER COLUMN "payPeriod" DROP NOT NULL,
DROP COLUMN "directDepositDate",
ADD COLUMN     "directDepositDate" TIMESTAMP(3),
ALTER COLUMN "weekNumber" DROP NOT NULL,
ALTER COLUMN "driver" DROP NOT NULL,
ALTER COLUMN "driver" SET DATA TYPE TEXT,
DROP COLUMN "stops",
ADD COLUMN     "stops" INTEGER,
ALTER COLUMN "totalFromStops" DROP NOT NULL,
ALTER COLUMN "totalBonus" DROP NOT NULL,
ALTER COLUMN "totalDeductions" DROP NOT NULL,
ALTER COLUMN "netPay" DROP NOT NULL,
ALTER COLUMN "driverName" DROP NOT NULL,
ALTER COLUMN "payrollSummary" DROP NOT NULL,
ALTER COLUMN "payrollSummary" SET DATA TYPE TEXT,
ALTER COLUMN "totalStopsCompleted" DROP NOT NULL,
ALTER COLUMN "salaryType" DROP NOT NULL,
ALTER COLUMN "salaryType" SET DATA TYPE TEXT,
ALTER COLUMN "subtotal" DROP NOT NULL,
ALTER COLUMN "created" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."Driver" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "Status" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "OFIDNumber" INTEGER,
    "salaryType" TEXT NOT NULL,
    "schedule" TEXT[],
    "dayoftheweek" TEXT,
    "driverAvailableToday" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Driver_email_key" ON "public"."Driver"("email");
