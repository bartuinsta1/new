-- Masal Dükkanı: tek seferlik (Non-Consumable) paket sahipliği. Bir App Store işlemi aynı anda tek hesaptadır;
-- "geri yükle" ile yeni hesaba taşınır. İade edilince revoked_at dolar.
create table public.purchases (
  original_transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id like 'masalcik.pack.%'),
  environment text,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index purchases_user on public.purchases (user_id) where revoked_at is null;
alter table public.purchases enable row level security;
create policy "own purchases" on public.purchases for select using (user_id = auth.uid());
