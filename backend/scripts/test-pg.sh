#!/usr/bin/env bash
# Postgres depolarını gerçek veritabanında test eder.
# Kullanım: PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./scripts/test-pg.sh
#   (yerel bir Postgres 15+ çalışıyor olmalı; "masalcik_test" veritabanı her seferinde sıfırdan kurulur)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=masalcik_test
P="psql -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB"
$P -d $DB -f tests/pg/supabase-stub.sql
for f in supabase/migrations/*.sql; do $P -d $DB -f "$f"; done
# postgres.js unix soketini URL'den okumaz: testler TCP üzerinden bağlanır (soket yolu verilmişse localhost).
HOSTPART="${PGHOST:-localhost}"; [[ "$HOSTPART" == /* ]] && HOSTPART=localhost
URL="postgres://${PGUSER:-postgres}@$HOSTPART:${PGPORT:-5432}/$DB"
TEST_DATABASE_URL="$URL" node --experimental-strip-types --no-warnings --test tests/pg-stores.test.ts
