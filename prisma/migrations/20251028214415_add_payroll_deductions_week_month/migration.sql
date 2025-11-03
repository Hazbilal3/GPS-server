/*
  Warnings:

  - You are about to drop the column `totalBonus` on the `Payroll` table. All the data in the column will be lost.
  - Added the required column `month` to the `Payroll` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weekInMonth` to the `Payroll` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `Payroll` table without a default value. This is not possible if the table is not empty.
  - Made the column `netPay` on table `Payroll` required. This step will fail if there are existing NULL values in that column.
  - Made the column `totalDeductions` on table `Payroll` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Payroll" DROP COLUMN "totalBonus",
ADD COLUMN     "month" INTEGER NOT NULL,
ADD COLUMN     "weekInMonth" INTEGER NOT NULL,
ADD COLUMN     "year" INTEGER NOT NULL,
ALTER COLUMN "netPay" SET NOT NULL,
ALTER COLUMN "netPay" SET DEFAULT 0,
ALTER COLUMN "totalDeductions" SET NOT NULL;
