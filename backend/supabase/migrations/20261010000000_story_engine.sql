-- Adım 5: masal motoru — idempotency, dil, maliyet ve güvenlik logu ayrıntıları.

alter table public.stories
  add column language text not null default 'tr' check (language in ('tr', 'en')),
  add column idempotency_key text,
  add column source text not null default 'generated'
    check (source in ('generated', 'regenerated', 'fallback'));

-- Aynı kullanıcının aynı anahtarla tekrar isteği aynı masalı döndürür (yeniden üretim ve kota düşümü yok).
create unique index stories_family_idempotency on public.stories (family_id, idempotency_key)
  where idempotency_key is not null;

alter table public.flagged_content
  drop constraint flagged_content_stage_check,
  add constraint flagged_content_stage_check check (stage in ('input', 'rules', 'moderation', 'llm', 'fallback')),
  add column reasons text[] not null default '{}',
  add column language text not null default 'tr';
-- `excerpt` içinde çocuğun adı her zaman {CHILD} olarak maskelenir; kullanıcı kimliği tutulmaz.

alter table public.cost_log
  add column language text not null default 'tr',
  add column duration_minutes smallint,
  add column llm_cache_read_tokens int not null default 0,
  add column llm_cache_write_tokens int not null default 0,
  add column attempts smallint not null default 1,
  add column outcome text not null default 'generated'
    check (outcome in ('generated', 'regenerated', 'fallback', 'cached'));

-- Yönetim panosu için günlük özet (yalnızca service_role okur).
create view public.cost_daily as
  select date_trunc('day', created_at)::date as day,
         count(*) filter (where outcome <> 'cached') as stories,
         count(*) filter (where outcome = 'fallback') as fallbacks,
         count(*) filter (where outcome = 'regenerated') as regenerations,
         sum(estimated_cost_usd) as cost_usd,
         avg(estimated_cost_usd) filter (where outcome <> 'cached') as avg_cost_usd
    from public.cost_log
   group by 1;
revoke all on public.cost_daily from anon, authenticated;
