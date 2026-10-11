-- Adım 9: paylaşım bağlantıları ve hesap silme.

create table public.story_shares (
  token text primary key,                      -- 128 bit rastgele, URL güvenli
  family_id uuid not null references public.families(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
alter table public.story_shares enable row level security;
-- Oluşturma ve okuma yalnızca Edge Function (service_role) üzerinden; istemci doğrudan erişemez.

-- Hesap silme: auth kullanıcısı silinince aile → çocuklar → masallar → paylaşımlar, kullanım, abonelik ve
-- ses klonu kayıtları cascade ile silinir (bkz. önceki migrasyonlardaki `on delete cascade`).
-- Storage'daki ses dosyaları ve TTS sağlayıcısındaki klon ses ayrıca account fonksiyonunda silinir.
