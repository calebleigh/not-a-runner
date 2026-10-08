-- Synced app data: one row per entry ("logs/3-1-c", "settings/name", "plan"), per user.
-- See src/sync/engine.ts for how the app reads and writes these.
create table if not exists public.entries (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key        text        not null,
  value      jsonb,
  deleted    boolean     not null default false,
  -- When the edit happened on the device (ms since 1970). Later edits win.
  edited_at  bigint      not null,
  -- Server time of the last write. Devices download rows newer than the last one they saw.
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists entries_user_updated on public.entries (user_id, updated_at);

-- Every write gets a fresh server time, so the download cursor always moves forward.
create or replace function public.entries_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before insert or update on public.entries
  for each row execute function public.entries_touch();

-- An older edit never overwrites a newer one, even if two devices upload at the same moment.
create or replace function public.entries_keep_newer() returns trigger
language plpgsql as $$
begin
  if new.edited_at < old.edited_at then
    return null;
  end if;
  return new;
end $$;

drop trigger if exists entries_keep_newer on public.entries;
create trigger entries_keep_newer before update on public.entries
  for each row execute function public.entries_keep_newer();

-- People can only see and change their own rows.
alter table public.entries enable row level security;

drop policy if exists "own rows" on public.entries;
create policy "own rows" on public.entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
