-- Sunucu tarafı kalıcılık (Edge Function depoları: _shared/pg/stores.ts).
-- Aile ve çocuk profilleri cihazda (SwiftData) tutulur; sunucu yalnızca anonim kullanıcı kimliğiyle çalışır.
-- Bu yüzden masallar ve paylaşımlar `families` yerine doğrudan `auth.users`'a bağlanır. (Lansmandan önce:
-- tablolar boş olduğundan veri taşıma gerekmez.)

-- Masallar
alter table public.stories
  add column user_id uuid not null references auth.users(id) on delete cascade,
  alter column family_id drop not null;
drop index if exists public.stories_family_idempotency;
create unique index stories_user_idempotency on public.stories (user_id, idempotency_key)
  where idempotency_key is not null;
create index stories_user_created on public.stories (user_id, created_at desc);
drop policy "own stories" on public.stories;
create policy "own stories" on public.stories for select using (user_id = auth.uid());

-- Paylaşım bağlantıları
alter table public.story_shares
  add column user_id uuid not null references auth.users(id) on delete cascade,
  alter column family_id drop not null;
create index story_shares_user on public.story_shares (user_id);

-- Maliyet logu: yalnızca seslendirme maliyeti satırı ("tts") da kaydedilir.
alter table public.cost_log drop constraint cost_log_outcome_check,
  add constraint cost_log_outcome_check check (outcome in ('generated', 'regenerated', 'fallback', 'cached', 'tts'));
create index cost_log_created on public.cost_log (created_at);

-- İşaret logunda eski tek "reason" sütunu yerine reasons[] kullanılır.
alter table public.flagged_content alter column reason drop not null;

-- Ses klonu: rıza anı zorunlu kalır; sağlayıcı silinince satır silinir.
-- (voice_clones zaten user_id birincil anahtarlı.)

-- Ses dosyaları Storage'da ("audio" özel kovası): ortak sesler `tts/<sha256>.mp3`, ebeveyn klon sesiyle üretilenler
-- `clone/<user_id>/<sha256>.mp3` — klon ya da hesap silinince bu klasör tümüyle silinir.

-- Anonim, toplu kullanım olayları (§6): kişi kimliği yok; gün + olay adı + kaba boyutlar başına sayaç.
create table public.analytics_daily (
  day date not null,
  name text not null check (name ~ '^[a-z_]{1,40}$'),
  dims jsonb not null default '{}',     -- ör. {"region":"star_hill","mood":"calm"}; serbest metin yok
  count int not null default 0,
  primary key (day, name, dims)
);
alter table public.analytics_daily enable row level security;
