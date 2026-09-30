alter table public.products
  add column if not exists compare_at_price numeric,
  add column if not exists tags text[],
  add column if not exists vendor text,
  add column if not exists product_type text,
  add column if not exists sku text,
  add column if not exists variants jsonb,
  add column if not exists options jsonb;
