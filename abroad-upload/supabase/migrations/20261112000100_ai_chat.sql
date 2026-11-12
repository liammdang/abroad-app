-- ───────────── AI Companion chat history ─────────────
create table if not exists public.ai_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_user_time on public.ai_messages (user_id, created_at desc);
alter table public.ai_messages enable row level security;
-- users read and clear their own history; only the ai-chat edge function (service role) writes
create policy "ai_messages: read own" on public.ai_messages for select to authenticated using (auth.uid() = user_id);
create policy "ai_messages: delete own" on public.ai_messages for delete to authenticated using (auth.uid() = user_id);
