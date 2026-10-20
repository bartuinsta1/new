-- Testler için Supabase'in sağladığı en küçük ortam: roller, auth.users, auth.uid().
-- Gerçek Supabase'de bunlar zaten vardır; bu dosya yalnızca yerel Postgres'te migrasyonları denemek içindir.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
