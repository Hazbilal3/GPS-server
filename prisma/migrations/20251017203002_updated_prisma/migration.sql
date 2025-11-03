/*
  Warnings:

  - A unique constraint covering the columns `[phoneNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Upload" ADD COLUMN     "lastevent" TEXT,
ADD COLUMN     "lasteventdata" TEXT,
ADD COLUMN     "sequenceNo" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "resetCodeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resetCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetCodeHash" TEXT,
ALTER COLUMN "phoneNumber" SET DATA TYPE VARCHAR(20);

-- CreateTable
CREATE TABLE "public"."Payroll" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "driverName" TEXT NOT NULL,
    "zipCode" TEXT,
    "address" TEXT,
    "weekNumber" INTEGER,
    "payPeriod" TEXT,
    "salaryType" TEXT,
    "stopsCompleted" INTEGER NOT NULL,
    "totalDeliveries" INTEGER,
    "stopRate" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Route" (
    "id" SERIAL NOT NULL,
    "route_number" TEXT,
    "description" TEXT NOT NULL,
    "rate_per_stop" DOUBLE PRECISION NOT NULL,
    "zone" TEXT,
    "status" TEXT,
    "base_rate" DOUBLE PRECISION,
    "base_rate_company_vehicle" DOUBLE PRECISION,
    "schedule" TEXT[],
    "zip_code" TEXT[],
    "day_of_the_week" TEXT,
    "route_scheduled_for_today" TEXT,
    "rate_per_stop_company_vehicle" DOUBLE PRECISION,
    "route" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "public"."User"("phoneNumber");

-- AddForeignKey
ALTER TABLE "public"."Payroll" ADD CONSTRAINT "Payroll_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."User"("driverId") ON DELETE RESTRICT ON UPDATE CASCADE;
