CREATE TYPE "EmailDeliveryFailureStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "EmailDeliveryFailure" (
  "id" TEXT NOT NULL,
  "to" TEXT[] NOT NULL,
  "cc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "bcc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subject" TEXT NOT NULL,
  "errorMessage" TEXT NOT NULL,
  "errorStack" TEXT,
  "status" "EmailDeliveryFailureStatus" NOT NULL DEFAULT 'OPEN',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDeliveryFailure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailDeliveryFailure_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "EmailDeliveryFailure_status_occurredAt_idx"
  ON "EmailDeliveryFailure"("status", "occurredAt");

CREATE INDEX "EmailDeliveryFailure_resolvedById_idx"
  ON "EmailDeliveryFailure"("resolvedById");
