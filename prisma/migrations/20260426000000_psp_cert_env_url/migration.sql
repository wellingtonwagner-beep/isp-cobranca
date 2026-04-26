-- Campos adicionais para integracao com PSPs Bacen-padrao (C6, Sicoob, BB, etc)
-- mTLS (cert + senha), ambiente sandbox/producao e URL base configuravel.
ALTER TABLE "company_settings"
  ADD COLUMN "pixPspBaseUrl" TEXT,
  ADD COLUMN "pixPspEnv" TEXT,
  ADD COLUMN "pixPspCertBase64" TEXT,
  ADD COLUMN "pixPspCertPassword" TEXT;
