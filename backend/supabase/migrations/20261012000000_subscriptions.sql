-- Adım 10: abonelik (StoreKit 2) ve haftalık kitaplık sayacı.

-- Bir App Store aboneliği (original_transaction_id) aynı anda yalnızca bir hesabı açar.
-- Geri yüklemede kayıt yeni hesaba taşınır (bkz. EntitlementStore.saveSubscription).
alter table public.entitlements
  add column environment text,
  add column revoked_at timestamptz;
create unique index entitlements_original_tx_unique
  on public.entitlements (original_transaction_id) where original_transaction_id is not null;

-- Haftalık limit "farklı masal" sayar: aynı masalı tekrar dinlemek hak harcamaz.
create table public.library_usage_weekly (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,            -- Türkiye saatiyle pazartesi
  story_id text not null,
  opened_at timestamptz not null default now(),
  primary key (user_id, week_start, story_id)
);
alter table public.library_usage_weekly enable row level security;
-- İstemci doğrudan yazamaz/okuyamaz; yalnızca Edge Function (service role) erişir. Politika tanımlanmadı = erişim yok.

-- App Store bildirimlerinin tekrar işlenmesini önlemek için (Apple aynı bildirimi yeniden gönderebilir).
create table public.appstore_notifications (
  notification_uuid uuid primary key,
  notification_type text not null,
  subtype text,
  original_transaction_id text,
  received_at timestamptz not null default now()
);
alter table public.appstore_notifications enable row level security;

-- usage_daily.library_stories artık kullanılmıyor (haftalık tabloya taşındı).
alter table public.usage_daily drop column library_stories;
