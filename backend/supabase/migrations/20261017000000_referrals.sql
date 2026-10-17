-- Adım 12: davet programı (davet eden + edilen 7 gün Premium).
create table public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.referral_redemptions (
  invitee_id uuid primary key references auth.users(id) on delete cascade,   -- hesap başına bir kez
  inviter_id uuid not null references auth.users(id) on delete cascade,
  inviter_rewarded boolean not null,
  redeemed_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);
create index referral_redemptions_inviter on public.referral_redemptions (inviter_id, redeemed_at);

-- Davet ödülü App Store aboneliğinden ayrı tutulur (iade/yenileme bildirimleri onu etkilemez).
alter table public.entitlements add column bonus_until timestamptz;

alter table public.referral_codes enable row level security;
alter table public.referral_redemptions enable row level security;
-- Politika yok: yalnızca Edge Function (service role) erişir.
