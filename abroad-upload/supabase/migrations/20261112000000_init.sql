-- Abroad: initial schema
-- Run in Supabase: SQL editor → paste → Run (or `supabase db push`).

-- ───────────── Profiles ─────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  city_id text not null check (city_id in ('berlin', 'madrid', 'lisbon')),
  university text not null,
  start_date date not null,
  end_date date not null,
  interests text[] not null default '{}',
  integrations jsonb not null default '{"googleCalendar": false, "googleMaps": true, "smartEmail": false}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);

-- ───────────── Life Admin progress ─────────────
create table if not exists public.task_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  done_at timestamptz not null default now(),
  primary key (user_id, task_id)
);
alter table public.task_progress enable row level security;
create policy "task_progress: own" on public.task_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────────── Calendar: imported events & iCal feeds ─────────────
create table if not exists public.user_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  title text not null,
  date date not null,
  end_date date,
  time text,
  place text,
  category text not null check (category in ('class', 'exam', 'assignment', 'admin', 'travel', 'social')),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.user_events enable row level security;
create policy "user_events: own" on public.user_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ical_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, url)
);
alter table public.ical_feeds enable row level security;
create policy "ical_feeds: own" on public.ical_feeds for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────────── Community: meetups ─────────────
create table if not exists public.meetups (
  id uuid primary key default gen_random_uuid(),
  city_id text not null check (city_id in ('berlin', 'madrid', 'lisbon')),
  category text not null,
  title text not null check (char_length(title) between 3 and 120),
  date date not null,
  time text not null,
  place text not null check (char_length(place) between 2 and 160),
  host_id uuid references auth.users (id) on delete set null,
  host_name text not null default 'Abroad team',
  created_at timestamptz not null default now()
);
create index if not exists meetups_city_date on public.meetups (city_id, date);
alter table public.meetups enable row level security;
create policy "meetups: signed-in can read" on public.meetups for select to authenticated using (true);
create policy "meetups: host can create" on public.meetups for insert to authenticated with check (auth.uid() = host_id);
create policy "meetups: host can delete" on public.meetups for delete to authenticated using (auth.uid() = host_id);

create table if not exists public.meetup_rsvps (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
alter table public.meetup_rsvps enable row level security;
create policy "rsvps: signed-in can read" on public.meetup_rsvps for select to authenticated using (true);
create policy "rsvps: add own" on public.meetup_rsvps for insert to authenticated with check (auth.uid() = user_id);
create policy "rsvps: remove own" on public.meetup_rsvps for delete to authenticated using (auth.uid() = user_id);

-- ───────────── Community: trips ─────────────
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  city_id text not null check (city_id in ('berlin', 'madrid', 'lisbon')),
  destination text not null check (char_length(destination) between 2 and 120),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  cost integer not null default 0 check (cost >= 0),
  capacity integer not null check (capacity between 2 and 50),
  description text not null default '' check (char_length(description) <= 600),
  host_id uuid references auth.users (id) on delete set null,
  host_name text not null default 'Abroad team',
  created_at timestamptz not null default now()
);
create index if not exists trips_city_date on public.trips (city_id, start_date);
alter table public.trips enable row level security;
create policy "trips: signed-in can read" on public.trips for select to authenticated using (true);
create policy "trips: host can create" on public.trips for insert to authenticated with check (auth.uid() = host_id);
create policy "trips: host can update" on public.trips for update to authenticated using (auth.uid() = host_id);
create policy "trips: host can delete" on public.trips for delete to authenticated using (auth.uid() = host_id);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  initials text not null check (char_length(initials) between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
alter table public.trip_members enable row level security;
create policy "trip_members: signed-in can read" on public.trip_members for select to authenticated using (true);
create policy "trip_members: join self" on public.trip_members for insert to authenticated with check (auth.uid() = user_id);
create policy "trip_members: leave self" on public.trip_members for delete to authenticated using (auth.uid() = user_id);

-- Stop people joining a full trip
create or replace function public.enforce_trip_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.trip_members where trip_id = new.trip_id)
     >= (select capacity from public.trips where id = new.trip_id) then
    raise exception 'This trip is full';
  end if;
  return new;
end $$;
drop trigger if exists trip_capacity on public.trip_members;
create trigger trip_capacity before insert on public.trip_members
  for each row execute function public.enforce_trip_capacity();

-- ───────────── AI Companion waitlist ─────────────
create table if not exists public.waitlist (
  email text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id uuid references auth.users (id) on delete set null,
  city_id text,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
create policy "waitlist: anyone can join" on public.waitlist for insert to anon, authenticated with check (true);

-- ───────────── Google refresh tokens (server-only) ─────────────
-- RLS on with no policies: only edge functions using the service role can read/write.
create table if not exists public.google_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.google_tokens enable row level security;

-- ───────────── Realtime: live community board ─────────────
alter publication supabase_realtime add table public.meetups, public.meetup_rsvps, public.trips, public.trip_members;
