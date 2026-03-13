-- ─────────────────────────────────────────────────────────────────────────────
-- Stealth Address Payment System — Supabase SQL Schema
-- Run this in Supabase SQL Editor or via migration
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── Users (handled by Supabase Auth, this is for extra profile data) ────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Automatically create profile on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Wallets ─────────────────────────────────────────────────────────────────
create table if not exists public.wallets (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  label                  text not null,
  bitgo_wallet_id        text not null unique,
  network                text not null default 'tbtc',  -- 'tbtc' | 'btc'

  -- Stealth key pair
  -- NOTE: private keys should be encrypted at rest with KMS/vault in production
  encrypted_view_priv_key  text not null,
  encrypted_spend_priv_key text not null,
  public_view_key          text not null,   -- A = a·G (33-byte compressed hex)
  public_spend_key         text not null,   -- B = b·G (33-byte compressed hex)

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.wallets enable row level security;

create policy "Users can read own wallets"
  on public.wallets for select using (auth.uid() = user_id);

create policy "Users can insert own wallets"
  on public.wallets for insert with check (auth.uid() = user_id);

create policy "Users can update own wallets"
  on public.wallets for update using (auth.uid() = user_id);

-- ─── Transactions ─────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  wallet_id           uuid not null references public.wallets(id) on delete cascade,

  tx_hash             text not null unique,
  direction           text not null check (direction in ('send', 'receive')),
  amount_sats         bigint not null,
  fee_sats            bigint not null default 0,
  ephemeral_public_key text,   -- R embedded in tx
  one_time_address    text,    -- P — the output address

  status              text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  note                text,
  created_at          timestamptz not null default now(),
  confirmed_at        timestamptz
);

alter table public.transactions enable row level security;

create policy "Users can read own transactions"
  on public.transactions for select
  using (exists (
    select 1 from public.wallets w
    where w.id = wallet_id and w.user_id = auth.uid()
  ));

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (exists (
    select 1 from public.wallets w
    where w.id = wallet_id and w.user_id = auth.uid()
  ));

create policy "Service role can update transactions"
  on public.transactions for update
  using (true);

-- ─── Detected Stealth Payments ────────────────────────────────────────────────
create table if not exists public.detected_payments (
  id                   uuid primary key default gen_random_uuid(),
  wallet_id            uuid not null references public.wallets(id) on delete cascade,

  tx_hash              text not null unique,
  one_time_address     text not null,   -- P
  ephemeral_public_key text not null,   -- R
  amount_sats          bigint not null,
  block_height         integer,

  spent_tx_hash        text,
  spent_at             timestamptz,

  created_at           timestamptz not null default now()
);

alter table public.detected_payments enable row level security;

create policy "Users can read own detected payments"
  on public.detected_payments for select
  using (exists (
    select 1 from public.wallets w
    where w.id = wallet_id and w.user_id = auth.uid()
  ));

create policy "Service role can insert detected payments"
  on public.detected_payments for insert
  with check (true);

create policy "Service role can update detected payments"
  on public.detected_payments for update
  using (true);

-- ─── Scanner State ────────────────────────────────────────────────────────────
create table if not exists public.scanner_state (
  id                   uuid primary key default gen_random_uuid(),
  wallet_id            uuid not null unique references public.wallets(id) on delete cascade,
  last_scanned_block   integer not null default 0,
  updated_at           timestamptz not null default now()
);

alter table public.scanner_state enable row level security;

create policy "Service role manages scanner state"
  on public.scanner_state for all using (true);

-- ─── Updated-at triggers ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_wallets_updated_at
  before update on public.wallets
  for each row execute procedure public.set_updated_at();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
