-- ── CompanySettings: campos PSP (PIX dinamico) ─────────────────────────────
ALTER TABLE "company_settings"
  ADD COLUMN "pixPsp" TEXT,
  ADD COLUMN "pixPspApiKey" TEXT,
  ADD COLUMN "pixPspClientId" TEXT,
  ADD COLUMN "pixPspClientSecret" TEXT,
  ADD COLUMN "pixPspWebhookSecret" TEXT,
  ADD COLUMN "pixKeyType" TEXT,
  ADD COLUMN "pixKeyValue" TEXT,
  ADD COLUMN "pixBeneficiaryName" TEXT,
  ADD COLUMN "pixBeneficiaryCity" TEXT;

-- ── Invoices: campos novos para banco proprio ──────────────────────────────
ALTER TABLE "invoices"
  ADD COLUMN "sequentialNumber" INTEGER,
  ADD COLUMN "productId" TEXT,
  ADD COLUMN "subscriptionId" TEXT,
  ADD COLUMN "pixTxid" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "paidVia" TEXT,
  ADD COLUMN "paymentNote" TEXT,
  ADD COLUMN "description" TEXT;

-- ── Products ────────────────────────────────────────────────────────────────
CREATE TABLE "products" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "recurrence" TEXT NOT NULL DEFAULT 'once',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "products_companyId_idx" ON "products"("companyId");
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Subscriptions ──────────────────────────────────────────────────────────
CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "dayOfMonth" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastGeneratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subscriptions_companyId_idx" ON "subscriptions"("companyId");
CREATE INDEX "subscriptions_clientId_idx" ON "subscriptions"("clientId");
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Invoices: FK para Product e Subscription ──────────────────────────────
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
