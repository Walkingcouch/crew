-- ═══════════════════════════════════════════════════════════════════════════
-- CREW PLATFORM — SUPABASE SCHEMA
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── 1. ORGANISATIONS ──────────────────────────────────────────────────────
create table organisations (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  abn           text,
  plan_type     text default 'small' check (plan_type in ('sole_trader','micro','small','medium','large','crewbase')),
  product       text default 'crew' check (product in ('crew','crewbase')),
  owner_id      uuid,
  address       text,
  phone         text,
  email         text,
  logo_url      text,
  settings      jsonb default '{}',
  created_at    timestamptz default now()
);

-- ── 2. USERS (extends Supabase auth.users) ─────────────────────────────────
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  org_id        uuid references organisations(id),
  name          text not null,
  email         text not null,
  phone         text,
  role          text not null check (role in ('customer','crew_member','crew_manager','admin','field_worker','supervisor','crewbase_admin')),
  avatar_url    text,
  avatar_initials text,
  status        text default 'active' check (status in ('active','inactive','suspended')),
  last_seen     timestamptz,
  metadata      jsonb default '{}',
  created_at    timestamptz default now()
);

-- ── 3. CUSTOMERS ───────────────────────────────────────────────────────────
create table customers (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  user_id         uuid references users(id),
  name            text not null,
  email           text,
  phone           text,
  address         text,
  suburb          text,
  state           text default 'VIC',
  postcode        text,
  notes           text,
  crewpass_points integer default 0,
  crewpass_tier   text default 'bronze' check (crewpass_tier in ('bronze','silver','gold','platinum')),
  properties      jsonb default '[]',
  created_at      timestamptz default now()
);

-- ── 4. WORKERS ─────────────────────────────────────────────────────────────
create table workers (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  user_id         uuid references users(id),
  name            text not null,
  email           text,
  phone           text,
  role            text default 'crew_member',
  employment_type text default 'casual' check (employment_type in ('casual','part_time','full_time','subcontractor')),
  hourly_rate     numeric(8,2),
  status          text default 'active' check (status in ('active','inactive','on_leave')),
  avatar_initials text,
  skills          text[] default '{}',
  certifications  jsonb default '[]',
  gps_lat         numeric(10,6),
  gps_lng         numeric(10,6),
  gps_updated_at  timestamptz,
  abn             text,
  pli_expiry      date,
  created_at      timestamptz default now()
);

-- ── 5. JOBS ────────────────────────────────────────────────────────────────
create table jobs (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  job_ref         text unique,
  customer_id     uuid references customers(id),
  worker_id       uuid references workers(id),
  service_type    text not null,
  description     text,
  address         text not null,
  suburb          text,
  state           text default 'VIC',
  status          text default 'incoming' check (status in ('incoming','active','completed','cancelled','hold','disputed')),
  price           numeric(10,2),
  price_gst       numeric(10,2),
  duration_hours  numeric(4,2),
  lead_source     text,
  quote_type      text check (quote_type in ('basic','recommended','premium')),
  scheduled_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  notes           text,
  photos          jsonb default '[]',
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);

-- Auto-generate job_ref
create or replace function generate_job_ref() returns trigger as $$
begin
  new.job_ref := 'JOB-' || to_char(now(), 'YYYY') || '-' || lpad(floor(random()*9000+1000)::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create trigger set_job_ref before insert on jobs
  for each row when (new.job_ref is null) execute function generate_job_ref();

-- ── 6. INVOICES ────────────────────────────────────────────────────────────
create table invoices (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  invoice_ref     text unique,
  job_id          uuid references jobs(id),
  customer_id     uuid references customers(id),
  subtotal        numeric(10,2) not null,
  gst             numeric(10,2) not null,
  total           numeric(10,2) not null,
  status          text default 'pending' check (status in ('draft','pending','paid','overdue','cancelled','disputed')),
  due_date        date,
  paid_at         timestamptz,
  payment_method  text,
  escrow_status   text default 'none' check (escrow_status in ('none','held','released','refunded')),
  notes           text,
  created_at      timestamptz default now()
);

create or replace function generate_invoice_ref() returns trigger as $$
begin
  new.invoice_ref := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(floor(random()*9000+1000)::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create trigger set_invoice_ref before insert on invoices
  for each row when (new.invoice_ref is null) execute function generate_invoice_ref();

-- ── 7. TIME ENTRIES ────────────────────────────────────────────────────────
create table time_entries (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  worker_id       uuid not null references workers(id),
  job_id          uuid references jobs(id),
  clock_in        timestamptz not null,
  clock_out       timestamptz,
  clock_in_lat    numeric(10,6),
  clock_in_lng    numeric(10,6),
  clock_out_lat   numeric(10,6),
  clock_out_lng   numeric(10,6),
  geofence_verified boolean default false,
  total_hours     numeric(5,2),
  notes           text,
  created_at      timestamptz default now()
);

-- ── 8. INCIDENTS ───────────────────────────────────────────────────────────
create table incidents (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  incident_ref    text unique,
  worker_id       uuid references workers(id),
  job_id          uuid references jobs(id),
  type            text not null check (type in ('injury','near_miss','property_damage','environmental','dangerous_occurrence','security')),
  severity        text default 'low' check (severity in ('low','medium','high','critical')),
  description     text not null,
  location        text,
  immediate_action text,
  corrective_actions jsonb default '[]',
  status          text default 'open' check (status in ('open','investigating','closed')),
  notifiable      boolean default false,
  regulator_notified boolean default false,
  photos          jsonb default '[]',
  created_at      timestamptz default now()
);

-- ── 9. LEAVE REQUESTS ──────────────────────────────────────────────────────
create table leave_requests (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  worker_id       uuid not null references workers(id),
  type            text not null check (type in ('annual','personal','carers','long_service','other')),
  from_date       date not null,
  to_date         date not null,
  total_days      numeric(4,1),
  reason          text,
  status          text default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  approved_by     uuid references users(id),
  created_at      timestamptz default now()
);

-- ── 10. MESSAGES ───────────────────────────────────────────────────────────
create table messages (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  channel         text not null,
  sender_id       uuid references users(id),
  sender_name     text,
  content         text not null,
  read_by         uuid[] default '{}',
  created_at      timestamptz default now()
);

-- ── 11. FORM SUBMISSIONS ───────────────────────────────────────────────────
create table form_submissions (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  form_type       text not null,
  form_code       text,
  worker_id       uuid references workers(id),
  job_id          uuid references jobs(id),
  data_json       jsonb not null default '{}',
  photo_url       text,
  ai_confidence   numeric(4,3),
  ai_notes        text,
  status          text default 'draft' check (status in ('draft','submitted','approved')),
  created_at      timestamptz default now()
);

-- ── 12. DOCUMENTS ──────────────────────────────────────────────────────────
create table documents (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  folder          text not null,
  subfolder       text,
  name            text not null,
  label           text,
  file_url        text,
  version         text,
  owner           text,
  status          text default 'current' check (status in ('current','review','draft','archived')),
  updated_at      date,
  created_at      timestamptz default now()
);

-- ── 13. EQUIPMENT ──────────────────────────────────────────────────────────
create table equipment (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  name            text not null,
  type            text,
  serial_number   text,
  status          text default 'operational' check (status in ('operational','maintenance','retired','fault')),
  assigned_to     uuid references workers(id),
  last_check_date date,
  next_check_date date,
  notes           text,
  created_at      timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

alter table organisations    enable row level security;
alter table users            enable row level security;
alter table customers        enable row level security;
alter table workers          enable row level security;
alter table jobs             enable row level security;
alter table invoices         enable row level security;
alter table time_entries     enable row level security;
alter table incidents        enable row level security;
alter table leave_requests   enable row level security;
alter table messages         enable row level security;
alter table form_submissions enable row level security;
alter table documents        enable row level security;
alter table equipment        enable row level security;

-- Helper function: get the org_id of the current user
create or replace function get_user_org_id() returns uuid as $$
  select org_id from users where id = auth.uid();
$$ language sql security definer stable;

-- RLS policies: users can only see/edit data belonging to their org
create policy "org_isolation" on organisations    using (id = get_user_org_id());
create policy "org_isolation" on customers        using (org_id = get_user_org_id());
create policy "org_isolation" on workers          using (org_id = get_user_org_id());
create policy "org_isolation" on jobs             using (org_id = get_user_org_id());
create policy "org_isolation" on invoices         using (org_id = get_user_org_id());
create policy "org_isolation" on time_entries     using (org_id = get_user_org_id());
create policy "org_isolation" on incidents        using (org_id = get_user_org_id());
create policy "org_isolation" on leave_requests   using (org_id = get_user_org_id());
create policy "org_isolation" on messages         using (org_id = get_user_org_id());
create policy "org_isolation" on form_submissions using (org_id = get_user_org_id());
create policy "org_isolation" on documents        using (org_id = get_user_org_id());
create policy "org_isolation" on equipment        using (org_id = get_user_org_id());

-- Users can see their own record
create policy "users_self" on users using (id = auth.uid());
-- Admins can see all users in their org
create policy "users_org_admin" on users using (
  org_id = get_user_org_id() and exists (
    select 1 from users u where u.id = auth.uid() and u.role in ('admin','crew_manager','crewbase_admin','supervisor')
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DEMO SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- Demo organisation (Crew)
insert into organisations (id, name, abn, plan_type, product, email, address)
values (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Green Thumb Landscaping',
  '12 345 678 901',
  'small',
  'crew',
  'admin@greenthumb.com.au',
  '123 Richmond Rd, Richmond VIC 3121'
);

-- Demo organisation (CrewBase)
insert into organisations (id, name, plan_type, product, email)
values (
  'a1b2c3d4-0000-0000-0000-000000000002',
  'City of Melbourne Council',
  'crewbase',
  'crewbase',
  'ops@melbourne.vic.gov.au'
);

-- Demo workers (Green Thumb)
insert into workers (org_id, name, email, phone, role, employment_type, hourly_rate, status, avatar_initials) values
('a1b2c3d4-0000-0000-0000-000000000001','Mike Rodriguez','mike@greenthumb.com.au','0412 111 222','crew_member','casual',28.50,'active','MR'),
('a1b2c3d4-0000-0000-0000-000000000001','Sarah Chen','sarah@greenthumb.com.au','0412 333 444','crew_member','casual',28.50,'active','SC'),
('a1b2c3d4-0000-0000-0000-000000000001','Alex Lopez','alex@greenthumb.com.au','0412 555 666','crew_member','casual',28.50,'active','AL'),
('a1b2c3d4-0000-0000-0000-000000000001','Tom Riley','tom@greenthumb.com.au','0412 777 888','crew_member','casual',28.50,'on_leave','TR'),
('a1b2c3d4-0000-0000-0000-000000000001','Emma Taylor','emma@greenthumb.com.au','0412 999 000','crew_member','casual',28.50,'active','ET'),
('a1b2c3d4-0000-0000-0000-000000000001','David Kim','david@greenthumb.com.au','0413 111 222','crew_member','casual',28.50,'active','DK');

-- Demo customers (Green Thumb)
insert into customers (org_id, name, email, phone, address, suburb, state, postcode, crewpass_points, crewpass_tier) values
('a1b2c3d4-0000-0000-0000-000000000001','Sarah Mitchell','sarah@mitchell.com.au','0411 222 333','24 Maple St','Richmond','VIC','3121',2480,'gold'),
('a1b2c3d4-0000-0000-0000-000000000001','Tom Chen','tom.chen@email.com','0411 444 555','56 Bridge Rd','Fitzroy','VIC','3065',820,'silver'),
('a1b2c3d4-0000-0000-0000-000000000001','Emma Davis','emma.d@email.com','0411 666 777','12 Chapel St','South Yarra','VIC','3141',340,'bronze'),
('a1b2c3d4-0000-0000-0000-000000000001','Robert Kim','r.kim@email.com','0411 888 999','8 Bay Rd','Brighton','VIC','3186',1200,'gold'),
('a1b2c3d4-0000-0000-0000-000000000001','Jessica Lee','j.lee@email.com','0414 111 222','33 Grattan St','Carlton','VIC','3053',0,'bronze');

-- Demo jobs
insert into jobs (org_id, service_type, address, suburb, state, status, price, price_gst, duration_hours, scheduled_at)
select
  'a1b2c3d4-0000-0000-0000-000000000001',
  unnest(array['Lawn Mow & Edge','Garden Cleanup','Hedge Trim','Lawn Mow & Edge','Full Garden Renovation']),
  unnest(array['24 Maple St','56 Bridge Rd','12 Chapel St','8 Bay Rd','33 Grattan St']),
  unnest(array['Richmond','Fitzroy','South Yarra','Brighton','Carlton']),
  'VIC',
  unnest(array['active','incoming','completed','incoming','hold']),
  unnest(array[95.00,180.00,160.00,95.00,485.00]),
  unnest(array[9.50,18.00,16.00,9.50,48.50]),
  unnest(array[1.5,3.0,2.0,1.5,6.0]),
  now() + interval '1 day';
