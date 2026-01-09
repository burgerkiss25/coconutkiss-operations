-- Enable extensions
create extension if not exists pgcrypto;

-- Base reference tables
create table if not exists joints (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_whatsapp text,
  note text,
  is_active boolean not null default true
);

create table if not exists sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  joint_id uuid references joints(id),
  pin_hash text,
  is_active boolean not null default true
);

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'supervisor'))
);

-- Ledger tables
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  joint_id uuid not null references joints(id),
  supplier_id uuid references suppliers(id),
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  note text
);

create table if not exists allocations (
  id uuid primary key default gen_random_uuid(),
  joint_id uuid not null references joints(id),
  seller_id uuid not null references sellers(id),
  qty_basis integer not null check (qty_basis > 0),
  basis_unit_price numeric not null default 6,
  created_at timestamptz not null default now(),
  note text
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  joint_id uuid not null references joints(id),
  seller_id uuid not null references sellers(id),
  amount_ghs numeric not null check (amount_ghs > 0),
  basis_unit_price numeric not null default 6,
  created_at timestamptz not null default now(),
  note text,
  confirmed_by_seller boolean not null default false,
  seller_confirm_ts timestamptz
);

create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  joint_id uuid not null references joints(id),
  seller_id uuid references sellers(id),
  counted_qty integer not null check (counted_qty >= 0),
  created_at timestamptz not null default now(),
  note text
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  event_ts timestamptz not null,
  joint_id uuid not null references joints(id),
  customer_name text,
  customer_phone text,
  location_note text,
  status text not null check (status in ('planned','confirmed','delivered','cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  note text
);

create table if not exists event_pricing (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  coconut_qty integer,
  coconut_unit_price numeric,
  delivery_fee numeric,
  opening_fee numeric,
  other_fee numeric,
  other_fee_note text
);

-- Indexes
create index if not exists idx_deliveries_joint on deliveries(joint_id, created_at);
create index if not exists idx_allocations_joint on allocations(joint_id, created_at);
create index if not exists idx_payments_joint on payments(joint_id, created_at);
create index if not exists idx_audits_joint on audits(joint_id, created_at);
create index if not exists idx_events_joint on events(joint_id, event_ts);

-- Helper functions for roles
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_supervisor()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles where user_id = auth.uid() and role in ('admin','supervisor')
  );
$$;

-- Payment confirmation function
create or replace function public.confirm_payment_with_pin(
  p_joint_id uuid,
  p_seller_id uuid,
  p_amount_ghs numeric,
  p_note text,
  p_pin text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_pin_hash text;
  v_payment_id uuid;
begin
  select pin_hash into v_pin_hash from sellers where id = p_seller_id;
  if v_pin_hash is null then
    raise exception 'Seller PIN not set';
  end if;
  if crypt(p_pin, v_pin_hash) <> v_pin_hash then
    raise exception 'Invalid PIN';
  end if;

  insert into payments (
    joint_id,
    seller_id,
    amount_ghs,
    basis_unit_price,
    note,
    confirmed_by_seller,
    seller_confirm_ts
  ) values (
    p_joint_id,
    p_seller_id,
    p_amount_ghs,
    6,
    p_note,
    true,
    now()
  ) returning id into v_payment_id;

  return v_payment_id;
end;
$$;

-- Event creation function
create or replace function public.create_event_with_pricing(
  p_event jsonb,
  p_pricing jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_event_id uuid;
begin
  insert into events (
    event_ts,
    joint_id,
    customer_name,
    customer_phone,
    location_note,
    status,
    created_by,
    note
  ) values (
    (p_event ->> 'event_ts')::timestamptz,
    (p_event ->> 'joint_id')::uuid,
    p_event ->> 'customer_name',
    p_event ->> 'customer_phone',
    p_event ->> 'location_note',
    p_event ->> 'status',
    auth.uid(),
    p_event ->> 'note'
  ) returning id into v_event_id;

  insert into event_pricing (
    event_id,
    coconut_qty,
    coconut_unit_price,
    delivery_fee,
    opening_fee,
    other_fee,
    other_fee_note
  ) values (
    v_event_id,
    nullif(p_pricing ->> 'coconut_qty', '')::integer,
    nullif(p_pricing ->> 'coconut_unit_price', '')::numeric,
    nullif(p_pricing ->> 'delivery_fee', '')::numeric,
    nullif(p_pricing ->> 'opening_fee', '')::numeric,
    nullif(p_pricing ->> 'other_fee', '')::numeric,
    p_pricing ->> 'other_fee_note'
  );

  return v_event_id;
end;
$$;

-- RLS
alter table joints enable row level security;
alter table suppliers enable row level security;
alter table sellers enable row level security;
alter table profiles enable row level security;
alter table deliveries enable row level security;
alter table allocations enable row level security;
alter table payments enable row level security;
alter table audits enable row level security;
alter table events enable row level security;
alter table event_pricing enable row level security;

-- Policies
create policy "Admins full access to joints" on joints
  for all using (is_admin()) with check (is_admin());
create policy "Supervisors read joints" on joints
  for select using (is_supervisor());

create policy "Admins full access to suppliers" on suppliers
  for all using (is_admin()) with check (is_admin());
create policy "Supervisors read suppliers" on suppliers
  for select using (is_supervisor());

create policy "Admins full access to sellers" on sellers
  for all using (is_admin()) with check (is_admin());
create policy "Supervisors read sellers" on sellers
  for select using (is_supervisor());

create policy "Profiles self access" on profiles
  for select using (auth.uid() = user_id);
create policy "Admins manage profiles" on profiles
  for all using (is_admin()) with check (is_admin());

create policy "Ledger write by supervisors" on deliveries
  for all using (is_supervisor()) with check (is_supervisor());
create policy "Ledger write by supervisors" on allocations
  for all using (is_supervisor()) with check (is_supervisor());
create policy "Ledger write by supervisors" on payments
  for all using (is_supervisor()) with check (is_supervisor());
create policy "Ledger write by supervisors" on audits
  for all using (is_supervisor()) with check (is_supervisor());

create policy "Events write by supervisors" on events
  for all using (is_supervisor()) with check (is_supervisor());
create policy "Events write by supervisors" on event_pricing
  for all using (is_supervisor()) with check (is_supervisor());

-- Seed data
insert into joints (name) values
  ('Motorway'),
  ('Tema West'),
  ('Washingbay'),
  ('Phil-Del Hotel'),
  ('Vivien Farm'),
  ('Junction Mall'),
  ('Addogono'),
  ('Kotobarbi')
on conflict do nothing;

insert into sellers (name, joint_id)
select 'Kojo', id from joints where name = 'Motorway'
union all
select 'Kobi', id from joints where name = 'Tema West'
union all
select 'Faiysel', id from joints where name = 'Washingbay'
union all
select 'Godwin', id from joints where name = 'Vivien Farm'
union all
select 'Kwaku Prince', id from joints where name = 'Junction Mall'
on conflict do nothing;
