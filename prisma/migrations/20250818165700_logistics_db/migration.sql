/*
  Warnings:

  - You are about to drop the column `firstname` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastname` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "firstname",
DROP COLUMN "lastname",
ADD COLUMN     "adminId" INTEGER,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "phoneNumber" INTEGER;
