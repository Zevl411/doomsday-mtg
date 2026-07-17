-- Provider-neutral event geography. All columns remain optional so historical
-- EDHTop16 records continue to work without backfilling invented locations.
alter table public.tournaments
  add column if not exists venue_name text,
  add column if not exists city text,
  add column if not exists state_region text,
  add column if not exists country_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_precision text
    check (location_precision is null or location_precision in (
      'exact', 'venue', 'city', 'state', 'country', 'online', 'unknown'
    )),
  add column if not exists is_online boolean,
  add column if not exists region_key text,
  add column if not exists location_source text,
  add column if not exists location_confidence text
    check (location_confidence is null or location_confidence in (
      'high', 'medium', 'low'
    ));

alter table public.tournament_entries
  add column if not exists commander_extraction_status text
    check (commander_extraction_status is null or commander_extraction_status in (
      'extracted', 'missing', 'invalid'
    )),
  add column if not exists decklist_availability text
    check (decklist_availability is null or decklist_availability in (
      'structured', 'plaintext', 'url', 'missing'
    ));

create index if not exists tournaments_country_code_idx
on public.tournaments(country_code);
create index if not exists tournaments_state_region_idx
on public.tournaments(state_region);
create index if not exists tournaments_region_key_idx
on public.tournaments(region_key);
create index if not exists tournaments_is_online_idx
on public.tournaments(is_online);
create index if not exists tournaments_region_event_date_idx
on public.tournaments(region_key, event_date desc);

-- This milestone deliberately retains one row per provider event. It does not
-- merge similarly named events. Strong explicit source IDs can be recorded
-- here without altering or deleting either provider's normalized row.
create table if not exists public.tournament_source_links (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  source text not null,
  source_tournament_id text not null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_tournament_id)
);

create index if not exists tournament_source_links_tournament_id_idx
on public.tournament_source_links(tournament_id);

alter table public.tournament_source_links enable row level security;
drop policy if exists "Tournament source links are publicly readable"
on public.tournament_source_links;
create policy "Tournament source links are publicly readable"
on public.tournament_source_links for select to anon, authenticated using (true);
grant select on public.tournament_source_links to anon, authenticated;
revoke insert, update, delete on public.tournament_source_links
from anon, authenticated;

-- Moderate evidence is diagnostic only. These rows are never auto-linked.
create or replace view public.possible_tournament_matches
with (security_invoker = true) as
select
  left_event.id as left_tournament_id,
  right_event.id as right_tournament_id,
  left_event.source as left_source,
  right_event.source as right_source,
  left_event.name,
  left_event.event_date,
  left_event.player_count
from public.tournaments left_event
join public.tournaments right_event
  on left_event.id < right_event.id
  and left_event.source <> right_event.source
  and lower(regexp_replace(left_event.name, '[^a-zA-Z0-9]+', '', 'g'))
    = lower(regexp_replace(right_event.name, '[^a-zA-Z0-9]+', '', 'g'))
  and left_event.event_date::date = right_event.event_date::date
  and abs(coalesce(left_event.player_count, 0)
    - coalesce(right_event.player_count, 0)) <= 2
where left_event.source_tournament_id <> right_event.source_tournament_id;

grant select on public.possible_tournament_matches to authenticated;

create or replace view public.linked_tournament_events
with (security_invoker = true) as
select tournament_id, count(*) source_count
from public.tournament_source_links
group by tournament_id
having count(*) > 1;

grant select on public.linked_tournament_events to authenticated;

-- Replace the aggregation RPC with optional event-location filters.
drop function if exists public.get_commander_metagame(
  timestamptz, timestamptz, integer, integer, integer
);

create function public.get_commander_metagame(
  start_date timestamptz default null,
  end_date timestamptz default null,
  minimum_players integer default 0,
  minimum_entries integer default 1,
  top_finish_threshold integer default 16,
  country_filter text default null,
  state_filter text default null,
  region_filter text default null,
  online_filter boolean default null
)
returns table (
  commander_key text, commander_name text, color_identity text[],
  entries bigint, tournaments bigint, wins bigint, losses bigint, draws bigint,
  match_win_rate numeric, top16_finishes bigint, top_cut_rate numeric,
  first_place_finishes bigint, meta_share numeric
)
language sql stable set search_path = ''
as $$
  with filtered as (
    select e.*
    from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
    where (start_date is null or t.event_date >= start_date)
      and (end_date is null or t.event_date < end_date + interval '1 day')
      and coalesce(t.player_count, 0) >= minimum_players
      and (country_filter is null or t.country_code = country_filter)
      and (state_filter is null or t.state_region = state_filter)
      and (region_filter is null or t.region_key = region_filter)
      and (online_filter is null or coalesce(t.is_online, false) = online_filter)
  ),
  totals as (select count(*)::numeric as entries from filtered),
  grouped as (
    select commander_key, max(commander_name) commander_name,
      ((array_agg(color_identity::text order by cardinality(color_identity) desc))[1])::text[]
        color_identity,
      count(*) entries, count(distinct tournament_id) tournaments,
      sum(wins)::bigint wins, sum(losses)::bigint losses, sum(draws)::bigint draws,
      count(*) filter (where standing <= top_finish_threshold) top16_finishes,
      count(*) filter (where standing = 1) first_place_finishes
    from filtered group by commander_key
  )
  select g.commander_key, g.commander_name, g.color_identity, g.entries,
    g.tournaments, g.wins, g.losses, g.draws,
    case when g.wins + g.losses + g.draws = 0 then 0
      else g.wins::numeric / (g.wins + g.losses + g.draws) end,
    g.top16_finishes,
    case when g.entries = 0 then 0 else g.top16_finishes::numeric / g.entries end,
    g.first_place_finishes,
    case when totals.entries = 0 then 0 else g.entries::numeric / totals.entries end
  from grouped g cross join totals
  where g.entries >= minimum_entries
  order by g.entries desc, g.commander_name;
$$;

grant execute on function public.get_commander_metagame(
  timestamptz, timestamptz, integer, integer, integer,
  text, text, text, boolean
) to anon, authenticated;

create or replace function public.get_regional_metagame(
  start_date timestamptz default null,
  end_date timestamptz default null,
  minimum_players integer default 0
)
returns table (
  region_key text, tournaments bigint, entries bigint,
  unique_commanders bigint, top_commander text, top_commander_entries bigint,
  average_tournament_size numeric
)
language sql stable set search_path = ''
as $$
  with filtered_tournaments as (
    select * from public.tournaments t
    where (start_date is null or t.event_date >= start_date)
      and (end_date is null or t.event_date < end_date + interval '1 day')
      and coalesce(t.player_count, 0) >= minimum_players
  ),
  commander_counts as (
    select coalesce(t.region_key, 'unknown') region_key, e.commander_name,
      count(*) entries,
      row_number() over (
        partition by coalesce(t.region_key, 'unknown')
        order by count(*) desc, e.commander_name
      ) rank
    from filtered_tournaments t
    join public.tournament_entries e on e.tournament_id = t.id
    group by coalesce(t.region_key, 'unknown'), e.commander_name
  ),
  summary as (
    select coalesce(t.region_key, 'unknown') region_key,
      count(distinct t.id) tournaments, count(e.id) entries,
      count(distinct e.commander_key) unique_commanders,
      avg(t.player_count)::numeric average_tournament_size
    from filtered_tournaments t
    left join public.tournament_entries e on e.tournament_id = t.id
    group by coalesce(t.region_key, 'unknown')
  )
  select s.region_key, s.tournaments, s.entries, s.unique_commanders,
    c.commander_name, coalesce(c.entries, 0), s.average_tournament_size
  from summary s left join commander_counts c
    on c.region_key = s.region_key and c.rank = 1
  order by s.tournaments desc, s.region_key;
$$;

grant execute on function public.get_regional_metagame(
  timestamptz, timestamptz, integer
) to anon, authenticated;
