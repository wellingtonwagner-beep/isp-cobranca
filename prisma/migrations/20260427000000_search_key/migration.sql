-- Coluna searchKey: contem nome lower + iniciais + identificadores,
-- usada para busca por substring/iniciais (ex: "MJS" matcha "MARIA JULIA SILVA").
-- Atualizada pela aplicacao em todo create/update.

ALTER TABLE "clients" ADD COLUMN "searchKey" TEXT;
ALTER TABLE "products" ADD COLUMN "searchKey" TEXT;

-- Popula clientes existentes: nome + iniciais (uma letra por palavra) + cpf/whats/phone
UPDATE "clients" SET "searchKey" =
  LOWER(name) || ' ' ||
  COALESCE(
    LOWER((SELECT string_agg(LEFT(word, 1), '') FROM regexp_split_to_table(name, '\s+') AS word WHERE LENGTH(word) > 0)),
    ''
  ) || ' ' ||
  COALESCE("cpfCnpj", '') || ' ' ||
  COALESCE(whatsapp, '') || ' ' ||
  COALESCE(phone, '');

-- Popula produtos existentes: nome + iniciais
UPDATE "products" SET "searchKey" =
  LOWER(name) || ' ' ||
  COALESCE(
    LOWER((SELECT string_agg(LEFT(word, 1), '') FROM regexp_split_to_table(name, '\s+') AS word WHERE LENGTH(word) > 0)),
    ''
  );

CREATE INDEX "clients_searchKey_idx" ON "clients" ("searchKey");
CREATE INDEX "products_searchKey_idx" ON "products" ("searchKey");
