-- Atualiza default da coluna plan e migra registros existentes para 'lite'
ALTER TABLE "companies" ALTER COLUMN "plan" SET DEFAULT 'lite';
UPDATE "companies" SET "plan" = 'lite' WHERE "plan" IN ('free', 'basic') OR "plan" IS NULL;
