-- Abroad: any city in the world + AI-personalized plan per student
-- Safe to run more than once.

-- cities are no longer limited to Berlin / Madrid / Lisbon
alter table public.profiles drop constraint if exists profiles_city_id_check;
alter table public.meetups  drop constraint if exists meetups_city_id_check;
alter table public.trips    drop constraint if exists trips_city_id_check;

-- extra profile details used by the AI
alter table public.profiles add column if not exists city_name    text;
alter table public.profiles add column if not exists country      text;
alter table public.profiles add column if not exists home_country text;
alter table public.profiles add column if not exists program      text;
alter table public.profiles add column if not exists about        text;
-- the plan Gemini generated for this student (checklist, spots, apps, key dates)
alter table public.profiles add column if not exists city_pack    jsonb;
