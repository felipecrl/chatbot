-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('ACTIVE', 'TRANSFERRED', 'SCHEDULED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'SCHEDULED', 'CONTACTED', 'LOST');

-- CreateTable
CREATE TABLE "conversations" (
    "id" SERIAL NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "state" "ConversationState" NOT NULL DEFAULT 'ACTIVE',
    "client_name" VARCHAR(255),
    "client_email" VARCHAR(255),
    "viewed_properties" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" SERIAL NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "property_code" VARCHAR(100),
    "property_description" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "crm_lead_id" VARCHAR(100),
    "crm_appointment_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_phone_number_key" ON "conversations"("phone_number");

-- CreateIndex
CREATE INDEX "conversations_state_idx" ON "conversations"("state");

-- CreateIndex
CREATE INDEX "conversations_updated_at_idx" ON "conversations"("updated_at");

-- CreateIndex
CREATE INDEX "leads_phone_number_idx" ON "leads"("phone_number");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");
