-- Run this in Supabase SQL Editor.
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade,email text,full_name text,phone text,tag_number text,vehicle_make text,vehicle_model text,vehicle_color text,updated_at timestamptz default now(),created_at timestamptz default now());
create table if not exists public.reservations (id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,customer_email text,customer_name text,customer_phone text,tag_number text,vehicle_make text,vehicle_model text,duration text,amount_usd numeric,checkin_date date,payment_intent_id text,status text default 'paid',created_at timestamptz default now());
alter table public.profiles enable row level security;alter table public.reservations enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.profiles;create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Users can view own reservations" on public.reservations;create policy "Users can view own reservations" on public.reservations for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own reservations" on public.reservations;create policy "Users can insert own reservations" on public.reservations for insert with check (auth.uid() = user_id);
