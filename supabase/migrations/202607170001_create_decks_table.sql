create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id text not null,
  name text not null,
  deck_data jsonb not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, deck_id)
);

create index if not exists decks_user_id_idx on public.decks(user_id);

-- Diagnostic query for operators investigating unexpected duplicate logical IDs:
-- select user_id, deck_id, count(*) from public.decks
-- group by user_id, deck_id having count(*) > 1;

create or replace function public.set_decks_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_decks_updated_at on public.decks;
create trigger set_decks_updated_at
before update on public.decks
for each row execute function public.set_decks_updated_at();

alter table public.decks enable row level security;

-- RLS is the authoritative ownership boundary. The browser also filters by
-- user_id for clarity, but it is never trusted as the only authorization.
create policy "Users can read their own decks"
on public.decks for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own decks"
on public.decks for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own decks"
on public.decks for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own decks"
on public.decks for delete to authenticated
using ((select auth.uid()) = user_id);
