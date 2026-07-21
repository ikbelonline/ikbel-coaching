-- ============================================================
--  Ikbel Coaching — FOOD / MEAL LOG
--  Clients record what they actually eat; the coach reviews it.
-- ============================================================
create table if not exists public.meals (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  eaten_at    timestamptz not null default now(),
  meal_type   text check (meal_type in ('breakfast','lunch','dinner','snack')),
  description text,
  calories    int,
  photo_path  text,          -- optional plate photo, stored in the 'photos' bucket
  created_at  timestamptz not null default now()
);

alter table public.meals enable row level security;

-- same rule as the other tables: client sees own meals, coach sees their clients'
drop policy if exists meals_rw on public.meals;
create policy meals_rw on public.meals for all
  using ( client_id = auth.uid() or public.coaches(client_id) )
  with check ( client_id = auth.uid() or public.coaches(client_id) );

create index if not exists meals_client_time on public.meals (client_id, eaten_at desc);
