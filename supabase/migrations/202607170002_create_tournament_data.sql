create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_tournament_id text not null,
  name text not null,
  event_date timestamptz,
  player_count integer check (player_count is null or player_count >= 0),
  source_url text,
  source_payload jsonb,
  imported_at timestamptz not null default now(),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_tournament_id)
);

create table if not exists public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  source_entry_id text,
  -- The adapter derives this when a provider has no reliable entry ID.
  source_entry_key text not null,
  player_name text,
  player_external_id text,
  commander_name text not null,
  commander_key text not null,
  color_identity text[] not null default '{}',
  standing integer check (standing is null or standing > 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  win_rate numeric,
  decklist_url text,
  source_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, source_entry_key)
);

-- Membership in this table is the server-side ingestion authorization.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists tournaments_event_date_idx
on public.tournaments(event_date);
create index if not exists tournaments_player_count_idx
on public.tournaments(player_count);
create index if not exists tournament_entries_tournament_id_idx
on public.tournament_entries(tournament_id);
create index if not exists tournament_entries_commander_key_idx
on public.tournament_entries(commander_key);
create index if not exists tournament_entries_standing_idx
on public.tournament_entries(standing);
create index if not exists tournament_entries_decklist_url_idx
on public.tournament_entries(decklist_url) where decklist_url is not null;

drop trigger if exists set_tournaments_updated_at on public.tournaments;
create trigger set_tournaments_updated_at
before update on public.tournaments
for each row execute function public.set_decks_updated_at();

drop trigger if exists set_tournament_entries_updated_at
on public.tournament_entries;
create trigger set_tournament_entries_updated_at
before update on public.tournament_entries
for each row execute function public.set_decks_updated_at();

alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.admin_users enable row level security;

-- Tournament data is public reference data. Browser clients receive SELECT
-- only; trusted Edge Functions write with the server-side service role.
drop policy if exists "Tournament data is publicly readable"
on public.tournaments;
create policy "Tournament data is publicly readable"
on public.tournaments for select to anon, authenticated using (true);

drop policy if exists "Tournament entries are publicly readable"
on public.tournament_entries;
create policy "Tournament entries are publicly readable"
on public.tournament_entries for select to anon, authenticated using (true);

-- Users can verify only their own admin membership. They cannot grant it.
drop policy if exists "Admins can read their own membership"
on public.admin_users;
create policy "Admins can read their own membership"
on public.admin_users for select to authenticated
using ((select auth.uid()) = user_id);

grant select on public.tournaments, public.tournament_entries
to anon, authenticated;
grant select on public.admin_users to authenticated;
revoke insert, update, delete on public.tournaments, public.tournament_entries
from anon, authenticated;
revoke insert, update, delete on public.admin_users from anon, authenticated;

-- Server-side aggregation keeps large result sets out of the static frontend.
create or replace function public.get_commander_metagame(
  start_date timestamptz default null,
  end_date timestamptz default null,
  minimum_players integer default 0,
  minimum_entries integer default 1,
  top_finish_threshold integer default 16
)
returns table (
  commander_key text,
  commander_name text,
  color_identity text[],
  entries bigint,
  tournaments bigint,
  wins bigint,
  losses bigint,
  draws bigint,
  match_win_rate numeric,
  top16_finishes bigint,
  top_cut_rate numeric,
  first_place_finishes bigint,
  meta_share numeric
)
language sql
stable
set search_path = ''
as $$
  with filtered as (
    select e.*, t.event_date, t.player_count
    from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
    where (start_date is null or t.event_date >= start_date)
      and (end_date is null or t.event_date < end_date + interval '1 day')
      and coalesce(t.player_count, 0) >= minimum_players
  ),
  totals as (select count(*)::numeric as entries from filtered),
  grouped as (
    select
      commander_key,
      max(commander_name) as commander_name,
      -- Cast through text so array_agg keeps each complete color identity as
      -- one value instead of flattening text[] values into individual colors.
      ((array_agg(color_identity::text))[1])::text[] as color_identity,
      count(*) as entries,
      count(distinct tournament_id) as tournaments,
      sum(wins)::bigint as wins,
      sum(losses)::bigint as losses,
      sum(draws)::bigint as draws,
      count(*) filter (where standing <= top_finish_threshold) as top16_finishes,
      count(*) filter (where standing = 1) as first_place_finishes
    from filtered
    group by commander_key
  )
  select
    g.commander_key,
    g.commander_name,
    g.color_identity,
    g.entries,
    g.tournaments,
    g.wins,
    g.losses,
    g.draws,
    case when g.wins + g.losses + g.draws = 0 then 0
      else g.wins::numeric / (g.wins + g.losses + g.draws) end,
    g.top16_finishes,
    case when g.entries = 0 then 0
      else g.top16_finishes::numeric / g.entries end,
    g.first_place_finishes,
    case when totals.entries = 0 then 0
      else g.entries::numeric / totals.entries end
  from grouped g cross join totals
  where g.entries >= minimum_entries
  order by g.entries desc, g.commander_name;
$$;

grant execute on function public.get_commander_metagame(
  timestamptz, timestamptz, integer, integer, integer
) to anon, authenticated;
