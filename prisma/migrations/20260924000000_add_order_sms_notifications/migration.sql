ALTER TABLE "User" ADD COLUMN "smsOptedOut" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "OrderSmsNotification" (
  "id" SERIAL NOT NULL,
  "orderId" INTEGER NOT NULL,
  "driverId" INTEGER NOT NULL,
  "notificationType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "selectedOutboundNumber" TEXT NOT NULL,
  "messageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderSmsNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderSmsNotification_orderId_driverId_notificationType_key" ON "OrderSmsNotification"("orderId", "driverId", "notificationType");
CREATE INDEX "OrderSmsNotification_orderId_status_idx" ON "OrderSmsNotification"("orderId", "status");
