create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_email text,
  customer_name text,
  customer_phone text,
  tag_number text,
  vehicle_make text,
  duration text,
  amount_usd numeric,
  payment_intent_id text,
  status text default 'paid',
  created_at timestamptz default now()
);

alter table reservations enable row level security;

create policy "Users can view own reservations"
on reservations for select
using (auth.uid() = user_id);

create policy "Users can insert own reservations"
on reservations for insert
with check (auth.uid() = user_id);