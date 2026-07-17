create table if not exists public.tournament_decks (
  id uuid primary key default gen_random_uuid(),
  tournament_entry_id uuid not null unique
    references public.tournament_entries(id) on delete cascade,
  source text not null,
  source_deck_id text,
  commander_key text not null,
  commander_name text not null,
  mainboard_card_count integer,
  sideboard_card_count integer,
  parsing_status text not null check (parsing_status in (
    'complete', 'partial', 'unavailable', 'invalid', 'pending'
  )),
  parsing_issues jsonb not null default '[]'::jsonb,
  raw_decklist_available boolean not null default false,
  structured_deck_available boolean not null default false,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_deck_cards (
  id uuid primary key default gen_random_uuid(),
  tournament_deck_id uuid not null
    references public.tournament_decks(id) on delete cascade,
  board text not null check (board in (
    'commander', 'mainboard', 'sideboard', 'maybeboard',
    'considering', 'companion', 'unknown'
  )),
  oracle_id uuid,
  scryfall_id uuid,
  normalized_card_key text not null check (length(trim(normalized_card_key)) > 0),
  card_name text not null,
  quantity integer not null check (quantity > 0),
  type_line text,
  color_identity text[],
  colors text[],
  mana_value numeric,
  is_basic_land boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_deck_id, board, normalized_card_key)
);

create index if not exists tournament_deck_cards_deck_idx
on public.tournament_deck_cards(tournament_deck_id);
create index if not exists tournament_deck_cards_key_idx
on public.tournament_deck_cards(normalized_card_key);
create index if not exists tournament_deck_cards_oracle_idx
on public.tournament_deck_cards(oracle_id);
create index if not exists tournament_deck_cards_board_idx
on public.tournament_deck_cards(board);
create index if not exists tournament_decks_commander_status_idx
on public.tournament_decks(commander_key, parsing_status);

drop trigger if exists set_tournament_decks_updated_at
on public.tournament_decks;
create trigger set_tournament_decks_updated_at
before update on public.tournament_decks
for each row execute function public.set_decks_updated_at();
drop trigger if exists set_tournament_deck_cards_updated_at
on public.tournament_deck_cards;
create trigger set_tournament_deck_cards_updated_at
before update on public.tournament_deck_cards
for each row execute function public.set_decks_updated_at();

alter table public.tournament_decks enable row level security;
alter table public.tournament_deck_cards enable row level security;
drop policy if exists "Tournament decks are publicly readable"
on public.tournament_decks;
create policy "Tournament decks are publicly readable"
on public.tournament_decks for select to anon, authenticated using (true);
drop policy if exists "Tournament deck cards are publicly readable"
on public.tournament_deck_cards;
create policy "Tournament deck cards are publicly readable"
on public.tournament_deck_cards for select to anon, authenticated using (true);
grant select on public.tournament_decks, public.tournament_deck_cards
to anon, authenticated;
revoke insert, update, delete on
  public.tournament_decks, public.tournament_deck_cards
from anon, authenticated;

create or replace function public.get_commander_card_inclusion(
  target_commander_key text,
  start_date timestamptz default null,
  end_date timestamptz default null,
  minimum_tournament_size integer default 0,
  country_filter text default null,
  state_filter text default null,
  region_filter text default null,
  online_filter boolean default null,
  maximum_standing integer default null,
  minimum_complete_decks integer default 1
)
returns table (
  normalized_card_key text, oracle_id uuid, card_name text, type_line text,
  color_identity text[], mana_value numeric, deck_count bigint,
  total_eligible_decks bigint, inclusion_rate numeric, average_quantity numeric,
  top16_deck_count bigint, top16_inclusion_rate numeric,
  first_place_deck_count bigint, first_place_inclusion_rate numeric
)
language sql stable set search_path = ''
as $$
  with eligible as (
    select d.id, e.standing
    from public.tournament_decks d
    join public.tournament_entries e on e.id = d.tournament_entry_id
    join public.tournaments t on t.id = e.tournament_id
    where d.commander_key = target_commander_key
      and d.parsing_status = 'complete'
      and (start_date is null or t.event_date >= start_date)
      and (end_date is null or t.event_date < end_date + interval '1 day')
      and coalesce(t.player_count, 0) >= minimum_tournament_size
      and (country_filter is null or t.country_code = country_filter)
      and (state_filter is null or t.state_region = state_filter)
      and (region_filter is null or t.region_key = region_filter)
      and (online_filter is null or coalesce(t.is_online, false) = online_filter)
      and (maximum_standing is null or e.standing <= maximum_standing)
  ),
  totals as (
    select count(*)::bigint total,
      count(*) filter (where standing <= 16)::bigint top16,
      count(*) filter (where standing = 1)::bigint first_place
    from eligible
  ),
  cards as (
    select c.normalized_card_key,
      (array_agg(c.oracle_id) filter (where c.oracle_id is not null))[1] oracle_id,
      max(c.card_name) card_name, max(c.type_line) type_line,
      ((array_agg(c.color_identity::text))[1])::text[] color_identity,
      max(c.mana_value) mana_value, count(distinct c.tournament_deck_id) decks,
      avg(c.quantity)::numeric average_quantity,
      count(distinct c.tournament_deck_id)
        filter (where e.standing <= 16) top16_decks,
      count(distinct c.tournament_deck_id)
        filter (where e.standing = 1) first_place_decks
    from public.tournament_deck_cards c
    join eligible e on e.id = c.tournament_deck_id
    where c.board = 'mainboard'
    group by c.normalized_card_key
  )
  select c.normalized_card_key, c.oracle_id, c.card_name, c.type_line,
    c.color_identity, c.mana_value, c.decks, t.total,
    case when t.total = 0 then 0 else c.decks::numeric / t.total end,
    c.average_quantity, c.top16_decks,
    case when t.top16 = 0 then 0
      else c.top16_decks::numeric / t.top16 end,
    c.first_place_decks,
    case when t.first_place = 0 then 0
      else c.first_place_decks::numeric / t.first_place end
  from cards c cross join totals t
  where t.total >= minimum_complete_decks
  order by c.decks desc, c.card_name;
$$;

grant execute on function public.get_commander_card_inclusion(
  text, timestamptz, timestamptz, integer, text, text, text,
  boolean, integer, integer
) to anon, authenticated;

-- Compact administrator coverage groups avoid loading every Deck into Vue.
create or replace function public.get_tournament_deck_coverage()
returns table (
  dimension text, group_key text, decks bigint, complete bigint,
  partial bigint, unavailable bigint, unresolved_cards bigint
)
language sql stable set search_path = ''
as $$
  with base as (
    select d.*, t.region_key, date_trunc('month', t.event_date) event_month
    from public.tournament_decks d
    join public.tournament_entries e on e.id = d.tournament_entry_id
    join public.tournaments t on t.id = e.tournament_id
  ),
  groups as (
    select 'provider'::text dimension, source group_key, * from base
    union all
    select 'region', coalesce(region_key, 'unknown'), * from base
    union all
    select 'month', coalesce(to_char(event_month, 'YYYY-MM'), 'unknown'), *
    from base
  )
  select g.dimension, g.group_key, count(*)::bigint,
    count(*) filter (where parsing_status = 'complete')::bigint,
    count(*) filter (where parsing_status = 'partial')::bigint,
    count(*) filter (where parsing_status = 'unavailable')::bigint,
    coalesce(sum((
      select count(*) from jsonb_array_elements(g.parsing_issues) issue
      where issue->>'code' = 'unknown_card'
    )), 0)::bigint
  from groups g
  group by g.dimension, g.group_key
  order by g.dimension, g.group_key desc;
$$;

grant execute on function public.get_tournament_deck_coverage()
to authenticated;
