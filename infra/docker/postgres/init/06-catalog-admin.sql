-- Merchant catalog admin: basic inventory qty on variants (Phase 1 catalog + inventory sketch)

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS inventory_quantity int NOT NULL DEFAULT 0
  CHECK (inventory_quantity >= 0);

-- Seed demo mug with stock so admin + storefront remain coherent after apply
UPDATE product_variants
SET inventory_quantity = 25
WHERE id = '30000000-0000-4000-8000-000000000001'
  AND inventory_quantity = 0;

UPDATE product_variants
SET inventory_quantity = 10
WHERE id = '30000000-0000-4000-8000-000000000002'
  AND inventory_quantity = 0;
