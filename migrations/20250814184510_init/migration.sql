-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "userRole" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Upload" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "gpsLocation" TEXT,
    "expectedLat" DOUBLE PRECISION,
    "expectedLng" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "status" TEXT,
    "googleMapsLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Export" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "gpsLocation" TEXT,
    "expectedLat" DOUBLE PRECISION,
    "expectedLng" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "status" TEXT,
    "matches" TEXT NOT NULL,
    "googleMapsLink" TEXT,
    "uploadId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_driverId_key" ON "public"."User"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Export" ADD CONSTRAINT "Export_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Export" ADD CONSTRAINT "Export_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "public"."Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
