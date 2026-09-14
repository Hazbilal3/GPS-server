-- CreateTable
CREATE TABLE "FreightDriver" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "phone" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "hourlyRate" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreightDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightTruck" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "plateNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreightTruck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightLoad" (
    "id" SERIAL NOT NULL,
    "loadNumber" TEXT,
    "company" TEXT,
    "orig" TEXT,
    "dest" TEXT,
    "serviceType" TEXT,
    "shipmentValue" TEXT,
    "agreedRate" DOUBLE PRECISION,
    "driverPay" DOUBLE PRECISION,
    "driverPayStatus" TEXT,
    "driverPaidAt" TIMESTAMP(3),
    "pickupCompany" TEXT,
    "pickupAddress" TEXT,
    "pickupCity" TEXT,
    "pickupState" TEXT,
    "pickupZip" TEXT,
    "pickupPhone" TEXT,
    "pickupContact" TEXT,
    "pickupDate" TIMESTAMP(3),
    "pickupReadyTime" TEXT,
    "pickupCloseTime" TEXT,
    "pickupNotes" TEXT,
    "deliveryCompany" TEXT,
    "deliveryAddress" TEXT,
    "deliveryCity" TEXT,
    "deliveryState" TEXT,
    "deliveryZip" TEXT,
    "deliveryContact" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "deliveryTime" TEXT,
    "deliveryOpenTime" TEXT,
    "deliveryCloseTime" TEXT,
    "deliveryNotes" TEXT,
    "poNumber" TEXT,
    "soNumber" TEXT,
    "invoiceRef" TEXT,
    "reference1" TEXT,
    "reference2" TEXT,
    "reference3" TEXT,
    "additionalServices" TEXT,
    "specialInstructions" TEXT,
    "pieces" INTEGER,
    "weight" DOUBLE PRECISION,
    "cargoLength" DOUBLE PRECISION,
    "cargoWidth" DOUBLE PRECISION,
    "cargoHeight" DOUBLE PRECISION,
    "cargoExt" DOUBLE PRECISION,
    "cargoDim" TEXT,
    "packageType" TEXT,
    "commodity" TEXT,
    "internalNotes" TEXT,
    "driverId" INTEGER,
    "truckId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'unassigned',
    "deliveredInFull" BOOLEAN,
    "deliveryException" BOOLEAN DEFAULT false,
    "exceptionNotes" TEXT,
    "podUrl" TEXT,
    "podUploadedAt" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "invoiceAmount" DOUBLE PRECISION,
    "invoiceDate" TIMESTAMP(3),
    "invoiceSentAt" TIMESTAMP(3),
    "invoiceRecipients" TEXT,
    "invoiceNotes" TEXT,
    "paymentTerms" TEXT,
    "paymentDueDate" TIMESTAMP(3),
    "amountPaid" DOUBLE PRECISION DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "billingStatus" TEXT,
    "billingCompany" TEXT,
    "billingContact" TEXT,
    "billingEmail" TEXT,
    "billingPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreightLoad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightPreTrip" (
    "id" SERIAL NOT NULL,
    "loadId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "license" BOOLEAN,
    "medicalCard" BOOLEAN,
    "registration" BOOLEAN,
    "insurance" BOOLEAN,
    "logbookEld" BOOLEAN,
    "lights" BOOLEAN,
    "horn" BOOLEAN,
    "tires" BOOLEAN,
    "lugNuts" BOOLEAN,
    "windshield" BOOLEAN,
    "wipers" BOOLEAN,
    "washerFluid" BOOLEAN,
    "mirrors" BOOLEAN,
    "brakes" BOOLEAN,
    "leaks" BOOLEAN,
    "fuel" BOOLEAN,
    "bolPaperwork" BOOLEAN,
    "palletJack" BOOLEAN,
    "strapsSecurement" BOOLEAN,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreightPreTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightClockSession" (
    "id" SERIAL NOT NULL,
    "loadId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "truckId" INTEGER,
    "clockInAt" TIMESTAMP(3) NOT NULL,
    "clockInLat" DOUBLE PRECISION,
    "clockInLng" DOUBLE PRECISION,
    "clockOutAt" TIMESTAMP(3),
    "clockOutLat" DOUBLE PRECISION,
    "clockOutLng" DOUBLE PRECISION,
    "totalMinutes" INTEGER,
    "corrections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreightClockSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightMilestone" (
    "id" SERIAL NOT NULL,
    "loadId" INTEGER NOT NULL,
    "milestone" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "FreightMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightDocument" (
    "id" SERIAL NOT NULL,
    "loadId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "FreightDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightLoadExpense" (
    "id" SERIAL NOT NULL,
    "loadId" INTEGER NOT NULL,
    "freightDriverId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreightLoadExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightDriverDispute" (
    "id" SERIAL NOT NULL,
    "freightDriverId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreightDriverDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightDisputeMessage" (
    "id" SERIAL NOT NULL,
    "disputeId" INTEGER NOT NULL,
    "senderRole" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreightDisputeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightDriverNotification" (
    "id" SERIAL NOT NULL,
    "freightDriverId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreightDriverNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FreightDriver_email_key" ON "FreightDriver"("email");

-- CreateIndex
CREATE INDEX "FreightLoad_status_idx" ON "FreightLoad"("status");

-- CreateIndex
CREATE INDEX "FreightLoad_driverId_idx" ON "FreightLoad"("driverId");

-- CreateIndex
CREATE INDEX "FreightPreTrip_loadId_idx" ON "FreightPreTrip"("loadId");

-- CreateIndex
CREATE INDEX "FreightPreTrip_driverId_idx" ON "FreightPreTrip"("driverId");

-- CreateIndex
CREATE INDEX "FreightClockSession_loadId_idx" ON "FreightClockSession"("loadId");

-- CreateIndex
CREATE INDEX "FreightClockSession_driverId_idx" ON "FreightClockSession"("driverId");

-- CreateIndex
CREATE INDEX "FreightMilestone_loadId_idx" ON "FreightMilestone"("loadId");

-- CreateIndex
CREATE INDEX "FreightDocument_loadId_idx" ON "FreightDocument"("loadId");

-- CreateIndex
CREATE INDEX "FreightLoadExpense_loadId_idx" ON "FreightLoadExpense"("loadId");

-- CreateIndex
CREATE INDEX "FreightLoadExpense_freightDriverId_idx" ON "FreightLoadExpense"("freightDriverId");

-- CreateIndex
CREATE INDEX "FreightDriverDispute_freightDriverId_idx" ON "FreightDriverDispute"("freightDriverId");

-- CreateIndex
CREATE INDEX "FreightDriverDispute_status_idx" ON "FreightDriverDispute"("status");

-- CreateIndex
CREATE INDEX "FreightDisputeMessage_disputeId_idx" ON "FreightDisputeMessage"("disputeId");

-- CreateIndex
CREATE INDEX "FreightDriverNotification_freightDriverId_idx" ON "FreightDriverNotification"("freightDriverId");

-- AddForeignKey
ALTER TABLE "FreightLoad" ADD CONSTRAINT "FreightLoad_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "FreightDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightLoad" ADD CONSTRAINT "FreightLoad_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "FreightTruck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightPreTrip" ADD CONSTRAINT "FreightPreTrip_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "FreightLoad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightPreTrip" ADD CONSTRAINT "FreightPreTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "FreightDriver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightClockSession" ADD CONSTRAINT "FreightClockSession_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "FreightLoad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightClockSession" ADD CONSTRAINT "FreightClockSession_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "FreightDriver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightClockSession" ADD CONSTRAINT "FreightClockSession_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "FreightTruck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightMilestone" ADD CONSTRAINT "FreightMilestone_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "FreightLoad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightDocument" ADD CONSTRAINT "FreightDocument_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "FreightLoad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightLoadExpense" ADD CONSTRAINT "FreightLoadExpense_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "FreightLoad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightLoadExpense" ADD CONSTRAINT "FreightLoadExpense_freightDriverId_fkey" FOREIGN KEY ("freightDriverId") REFERENCES "FreightDriver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightDriverDispute" ADD CONSTRAINT "FreightDriverDispute_freightDriverId_fkey" FOREIGN KEY ("freightDriverId") REFERENCES "FreightDriver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightDisputeMessage" ADD CONSTRAINT "FreightDisputeMessage_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "FreightDriverDispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightDriverNotification" ADD CONSTRAINT "FreightDriverNotification_freightDriverId_fkey" FOREIGN KEY ("freightDriverId") REFERENCES "FreightDriver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
