-- Bu Nedir? kaydı → diğer uygulamada 2 ay ücretsiz deneme kodu.
-- Yalnızca service_role erişir (fonksiyon üzerinden); istemcilere RLS ile tamamen kapalı.
create table if not exists public.trial_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^BN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  trial_days int not null default 60 check (trial_days > 0),
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  partner_user_id text,
  check ((redeemed_at is null) = (partner_user_id is null))
);

alter table public.trial_codes enable row level security;
revoke all on public.trial_codes from anon, authenticated;
