-- Masalcık başlangıç şeması (taslak). Tüm tablolarda RLS açık: bir aile yalnızca kendi satırlarını görür.
-- Veri minimizasyonu: çocuk için ad, yaş, ilgi alanları, değerler, telaffuz, avatar. Doğum tarihi/fotoğraf/konum yok.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  bedtime time not null default '20:00',
  created_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  age smallint not null check (age between 2 and 12),
  pronunciation text check (char_length(pronunciation) <= 40),
  interests text[] not null default '{}',
  "values" text[] not null default '{}',
  avatar jsonb not null default '{}',
  companion text not null default 'pamuk',
  created_at timestamptz not null default now()
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  title text not null,
  body jsonb not null,             -- Story JSON (paragraflar + ses URL'leri)
  region text not null,
  mood text not null,
  duration_minutes smallint not null,
  is_fallback boolean not null default false,
  created_at timestamptz not null default now()
);

-- Ücretsiz limit (§4.6): istemciye güvenmeden sunucuda sayılır.
create table public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  personal_stories int not null default 0,
  library_stories int not null default 0,
  primary key (user_id, day)
);

create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  product_id text,
  original_transaction_id text,
  expires_at timestamptz,
  is_in_trial boolean not null default false,
  verified_at timestamptz
);

create table public.voice_clones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_voice_id text not null,
  sample_path text,                -- Storage yolu; silinince null
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Kişisel veri İÇERMEYEN loglar: kullanıcı kimliği yok.
create table public.flagged_content (
  id bigint generated always as identity primary key,
  reason text not null,
  stage text not null check (stage in ('input', 'output')),
  excerpt text,                    -- çocuk adı maskelenmiş
  created_at timestamptz not null default now()
);

create table public.cost_log (
  id bigint generated always as identity primary key,
  llm_input_tokens int not null default 0,
  llm_output_tokens int not null default 0,
  tts_characters int not null default 0,
  estimated_cost_usd numeric(10, 5) not null default 0,
  was_regenerated boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;
alter table public.children enable row level security;
alter table public.stories enable row level security;
alter table public.usage_daily enable row level security;
alter table public.entitlements enable row level security;
alter table public.voice_clones enable row level security;
alter table public.flagged_content enable row level security;
alter table public.cost_log enable row level security;

create policy "own family" on public.families for all using (user_id = auth.uid());
create policy "own children" on public.children for all
  using (family_id in (select id from public.families where user_id = auth.uid()));
create policy "own stories" on public.stories for select
  using (family_id in (select id from public.families where user_id = auth.uid()));
create policy "own usage" on public.usage_daily for select using (user_id = auth.uid());
create policy "own entitlement" on public.entitlements for select using (user_id = auth.uid());
create policy "own voice" on public.voice_clones for select using (user_id = auth.uid());
-- flagged_content ve cost_log: yalnızca service_role (politika yok = istemci erişemez).
