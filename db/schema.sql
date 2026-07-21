-- ============================================================
--  Ikbel Coaching — database schema
--  Paste this whole file into Supabase → SQL Editor → Run.
--  Safe to re-run: everything uses "if not exists" / "or replace".
-- ============================================================

-- ---------- 1. PROFILES (one row per user: coach or client) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'client' check (role in ('coach','client')),
  coach_id    uuid references public.profiles(id) on delete set null, -- which coach owns this client
  full_name   text,
  phone       text,
  start_date  date default current_date,
  height_cm   numeric,
  goal        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- 2. WEIGH-INS (weight + body measurements over time) ----------
create table if not exists public.weigh_ins (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles(id) on delete cascade,
  date       date not null default current_date,
  weight_kg  numeric,
  waist_cm   numeric,
  hips_cm    numeric,
  chest_cm   numeric,
  arm_cm     numeric,
  thigh_cm   numeric,
  notes      text,
  created_at timestamptz not null default now(),
  unique (client_id, date)
);

-- ---------- 3. PHOTOS (progress photos; file lives in Storage) ----------
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  date         date not null default current_date,
  pose         text check (pose in ('front','side','back')),
  storage_path text not null,          -- path inside the 'photos' bucket
  created_at   timestamptz not null default now()
);

-- ---------- 4. ADHERENCE (one row per client per day) ----------
create table if not exists public.adherence (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles(id) on delete cascade,
  date       date not null default current_date,
  hit_plan   boolean not null default false,   -- did they follow the plan today?
  notes      text,
  created_at timestamptz not null default now(),
  unique (client_id, date)
);

-- ---------- 5. CHECK-INS (weekly review + coach feedback) ----------
create table if not exists public.checkins (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  week_start    date not null default date_trunc('week', current_date)::date,
  sleep         int check (sleep between 1 and 5),
  energy        int check (energy between 1 and 5),
  hunger        int check (hunger between 1 and 5),
  mood          int check (mood between 1 and 5),
  notes         text,                 -- client writes this
  coach_feedback text,                -- coach writes this
  created_at    timestamptz not null default now(),
  unique (client_id, week_start)
);

-- ============================================================
--  ROW-LEVEL SECURITY
--  Rule: a client sees ONLY their own data. A coach sees the
--  data of every client whose coach_id points at the coach.
-- ============================================================

alter table public.profiles  enable row level security;
alter table public.weigh_ins enable row level security;
alter table public.photos    enable row level security;
alter table public.adherence enable row level security;
alter table public.checkins  enable row level security;

-- helper: is the current user a coach?
create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach');
$$;

-- helper: does the current user coach this client?
create or replace function public.coaches(client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = client and p.coach_id = auth.uid()
  );
$$;

-- ---- PROFILES ----
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using ( id = auth.uid() or coach_id = auth.uid() or public.is_coach() );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using ( id = auth.uid() or coach_id = auth.uid() );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check ( id = auth.uid() );

-- ---- macro for the four data tables: own rows OR your coach's view ----
-- WEIGH-INS
drop policy if exists weigh_ins_rw on public.weigh_ins;
create policy weigh_ins_rw on public.weigh_ins for all
  using ( client_id = auth.uid() or public.coaches(client_id) )
  with check ( client_id = auth.uid() or public.coaches(client_id) );

-- PHOTOS
drop policy if exists photos_rw on public.photos;
create policy photos_rw on public.photos for all
  using ( client_id = auth.uid() or public.coaches(client_id) )
  with check ( client_id = auth.uid() or public.coaches(client_id) );

-- ADHERENCE
drop policy if exists adherence_rw on public.adherence;
create policy adherence_rw on public.adherence for all
  using ( client_id = auth.uid() or public.coaches(client_id) )
  with check ( client_id = auth.uid() or public.coaches(client_id) );

-- CHECK-INS
drop policy if exists checkins_rw on public.checkins;
create policy checkins_rw on public.checkins for all
  using ( client_id = auth.uid() or public.coaches(client_id) )
  with check ( client_id = auth.uid() or public.coaches(client_id) );

-- ============================================================
--  AUTO-CREATE a profile row whenever a new user signs up.
--  New users default to role 'client' and are AUTO-ATTACHED to the
--  coach — so clients can self-register (tap "اعمل حساب") and show up
--  in the dashboard automatically, no manual entry needed.
--  You promote yourself to 'coach' once, by hand (see SETUP.md step 6).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  default_coach uuid;
begin
  -- pick the coach to own new signups (single-coach setup: the one coach)
  select id into default_coach
    from public.profiles
   where role = 'coach'
   order by created_at
   limit 1;

  insert into public.profiles (id, full_name, coach_id)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.email),
          default_coach)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
