-- Card facts belong to one canonical record, not to every tournament Deck.
-- Aliases preserve provider spellings and flavor-name variants while Oracle ID
-- remains the preferred cross-printing identity.
create table if not exists public.canonical_cards (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid unique,
  scryfall_id uuid,
  normalized_card_key text not null
    check (length(trim(normalized_card_key)) > 0),
  card_name text not null,
  type_line text,
  color_identity text[] not null default '{}',
  colors text[] not null default '{}',
  mana_value numeric,
  is_basic_land boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.canonical_card_aliases (
  normalized_card_key text primary key
    check (length(trim(normalized_card_key)) > 0),
  canonical_card_id uuid not null
    references public.canonical_cards(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists canonical_cards_normalized_key_idx
on public.canonical_cards(normalized_card_key);
create index if not exists canonical_card_aliases_card_idx
on public.canonical_card_aliases(canonical_card_id);

drop trigger if exists set_canonical_cards_updated_at
on public.canonical_cards;
create trigger set_canonical_cards_updated_at
before update on public.canonical_cards
for each row execute function public.set_decks_updated_at();

alter table public.canonical_cards enable row level security;
alter table public.canonical_card_aliases enable row level security;
drop policy if exists "Canonical cards are publicly readable"
on public.canonical_cards;
create policy "Canonical cards are publicly readable"
on public.canonical_cards for select to anon, authenticated using (true);
drop policy if exists "Canonical card aliases are publicly readable"
on public.canonical_card_aliases;
create policy "Canonical card aliases are publicly readable"
on public.canonical_card_aliases for select to anon, authenticated using (true);
grant select on public.canonical_cards, public.canonical_card_aliases
to anon, authenticated;
revoke insert, update, delete on
  public.canonical_cards, public.canonical_card_aliases
from anon, authenticated;

alter table public.tournament_deck_cards
  add column if not exists canonical_card_id uuid
    references public.canonical_cards(id);

-- Preserve existing normalized rows if this migration is applied before a
-- development reset. Future ingestion writes only the canonical reference.
insert into public.canonical_cards (
  oracle_id, scryfall_id, normalized_card_key, card_name, type_line,
  color_identity, colors, mana_value, is_basic_land
)
select distinct on (oracle_id)
  oracle_id,
  scryfall_id,
  lower(trim(card_name)),
  card_name,
  type_line,
  coalesce(color_identity, '{}'),
  coalesce(colors, '{}'),
  mana_value,
  is_basic_land
from public.tournament_deck_cards
where oracle_id is not null
order by oracle_id, updated_at desc
on conflict (oracle_id) do update set
  scryfall_id = excluded.scryfall_id,
  normalized_card_key = excluded.normalized_card_key,
  card_name = excluded.card_name,
  type_line = excluded.type_line,
  color_identity = excluded.color_identity,
  colors = excluded.colors,
  mana_value = excluded.mana_value,
  is_basic_land = excluded.is_basic_land,
  updated_at = now();

insert into public.canonical_cards (
  normalized_card_key, card_name, type_line, color_identity, colors,
  mana_value, is_basic_land
)
select distinct on (lower(trim(legacy.normalized_card_key)))
  lower(trim(legacy.normalized_card_key)),
  legacy.card_name,
  legacy.type_line,
  coalesce(legacy.color_identity, '{}'),
  coalesce(legacy.colors, '{}'),
  legacy.mana_value,
  legacy.is_basic_land
from public.tournament_deck_cards legacy
where legacy.oracle_id is null
  and not exists (
    select 1 from public.canonical_cards canonical
    where canonical.normalized_card_key =
      lower(trim(legacy.normalized_card_key))
  )
order by lower(trim(legacy.normalized_card_key)), legacy.updated_at desc;

insert into public.canonical_card_aliases (
  normalized_card_key, canonical_card_id
)
select distinct
  lower(trim(legacy.normalized_card_key)),
  canonical.id
from public.tournament_deck_cards legacy
join public.canonical_cards canonical
  on (
    legacy.oracle_id is not null and canonical.oracle_id = legacy.oracle_id
  ) or (
    legacy.oracle_id is null and canonical.normalized_card_key =
      lower(trim(legacy.normalized_card_key))
  )
where legacy.normalized_card_key is not null
on conflict (normalized_card_key) do update
set canonical_card_id = excluded.canonical_card_id;

insert into public.canonical_card_aliases (
  normalized_card_key, canonical_card_id
)
select normalized_card_key, id from public.canonical_cards
on conflict (normalized_card_key) do nothing;

update public.tournament_deck_cards deck_card
set canonical_card_id = alias.canonical_card_id
from public.canonical_card_aliases alias
where deck_card.canonical_card_id is null
  and alias.normalized_card_key =
    lower(trim(deck_card.normalized_card_key));

-- Legacy columns stay nullable for a safe rolling deployment. They consume
-- only a null bitmap on new rows and can be removed after all deployed clients
-- read canonical_cards.
alter table public.tournament_deck_cards
  alter column normalized_card_key drop not null,
  alter column card_name drop not null;

do $$
declare legacy_constraint text;
begin
  select constraint_name into legacy_constraint
  from information_schema.table_constraints
  where table_schema = 'public'
    and table_name = 'tournament_deck_cards'
    and constraint_type = 'UNIQUE'
    and constraint_name like '%normalized%';
  if legacy_constraint is not null then
    execute format(
      'alter table public.tournament_deck_cards drop constraint %I',
      legacy_constraint
    );
  end if;
end;
$$;

create unique index if not exists tournament_deck_cards_canonical_unique_idx
on public.tournament_deck_cards(
  tournament_deck_id, board, canonical_card_id
);
create index if not exists tournament_deck_cards_canonical_idx
on public.tournament_deck_cards(canonical_card_id);
drop index if exists public.tournament_deck_cards_key_idx;
drop index if exists public.tournament_deck_cards_oracle_idx;

-- Later metadata refreshes must not restore a full provider Deck payload after
-- its canonical snapshot has already been committed.
create or replace function public.keep_normalized_entry_payload_compact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.tournament_decks deck
    where deck.tournament_entry_id = old.id
      and deck.parsing_status = 'complete'
  ) then
    new.source_payload = null;
  end if;
  return new;
end;
$$;

drop trigger if exists keep_normalized_entry_payload_compact
on public.tournament_entries;
create trigger keep_normalized_entry_payload_compact
before update of source_payload on public.tournament_entries
for each row execute function public.keep_normalized_entry_payload_compact();

-- A compatibility view centralizes the canonical join for analytics and
-- prevents each RPC from inventing a separate card-identity projection.
create or replace view public.tournament_deck_card_details
with (security_invoker = true) as
select
  deck_card.id,
  deck_card.tournament_deck_id,
  deck_card.board,
  deck_card.canonical_card_id,
  coalesce(canonical.oracle_id, deck_card.oracle_id) oracle_id,
  coalesce(canonical.scryfall_id, deck_card.scryfall_id) scryfall_id,
  coalesce(
    canonical.normalized_card_key,
    deck_card.normalized_card_key
  ) normalized_card_key,
  coalesce(canonical.card_name, deck_card.card_name) card_name,
  deck_card.quantity,
  coalesce(canonical.type_line, deck_card.type_line) type_line,
  coalesce(canonical.color_identity, deck_card.color_identity, '{}')
    color_identity,
  coalesce(canonical.colors, deck_card.colors, '{}') colors,
  coalesce(canonical.mana_value, deck_card.mana_value) mana_value,
  coalesce(canonical.is_basic_land, deck_card.is_basic_land, false)
    is_basic_land,
  deck_card.created_at,
  deck_card.updated_at
from public.tournament_deck_cards deck_card
left join public.canonical_cards canonical
  on canonical.id = deck_card.canonical_card_id;

grant select on public.tournament_deck_card_details to anon, authenticated;

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
    from public.tournament_deck_card_details c
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

create or replace function public.get_deck_comparison_aggregate(
  p_commander_key text,
  p_start_date date default null,
  p_end_date date default null,
  p_minimum_tournament_size integer default null,
  p_maximum_standing integer default null,
  p_country_code text default null,
  p_state_region text default null,
  p_region_key text default null,
  p_is_online boolean default null,
  p_minimum_complete_decks integer default 1
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
    where d.commander_key = p_commander_key
      and d.parsing_status = 'complete'
      and (p_start_date is null or t.event_date >= p_start_date)
      and (p_end_date is null or t.event_date < p_end_date + 1)
      and (
        p_minimum_tournament_size is null or
        coalesce(t.player_count, 0) >= p_minimum_tournament_size
      )
      and (p_maximum_standing is null or e.standing <= p_maximum_standing)
      and (p_country_code is null or t.country_code = p_country_code)
      and (p_state_region is null or t.state_region = p_state_region)
      and (p_region_key is null or t.region_key = p_region_key)
      and (p_is_online is null or coalesce(t.is_online, false) = p_is_online)
  ),
  totals as (
    select count(*)::bigint total,
      count(*) filter (where standing <= 16)::bigint top16,
      count(*) filter (where standing = 1)::bigint first_place
    from eligible
  ),
  card_rows as (
    select c.*,
      case
        when c.oracle_id is not null then 'oracle:' || lower(c.oracle_id::text)
        else 'name:' || lower(trim(c.normalized_card_key))
      end identity_key,
      e.standing
    from public.tournament_deck_card_details c
    join eligible e on e.id = c.tournament_deck_id
    where c.board = 'mainboard'
  ),
  cards as (
    select identity_key,
      min(normalized_card_key) normalized_card_key,
      (array_agg(oracle_id) filter (where oracle_id is not null))[1] oracle_id,
      max(card_name) card_name, max(type_line) type_line,
      ((array_agg(color_identity::text))[1])::text[] color_identity,
      max(mana_value) mana_value,
      count(distinct tournament_deck_id)::bigint deck_count,
      avg(quantity)::numeric average_quantity,
      count(distinct tournament_deck_id)
        filter (where standing <= 16)::bigint top16_deck_count,
      count(distinct tournament_deck_id)
        filter (where standing = 1)::bigint first_place_deck_count
    from card_rows group by identity_key
  )
  select c.normalized_card_key, c.oracle_id, c.card_name, c.type_line,
    c.color_identity, c.mana_value, c.deck_count, t.total,
    case when t.total = 0 then 0
      else c.deck_count::numeric / t.total end,
    c.average_quantity, c.top16_deck_count,
    case when t.top16 = 0 then 0
      else c.top16_deck_count::numeric / t.top16 end,
    c.first_place_deck_count,
    case when t.first_place = 0 then 0
      else c.first_place_deck_count::numeric / t.first_place end
  from cards c cross join totals t
  where t.total >= p_minimum_complete_decks
  order by c.deck_count desc, c.card_name;
$$;

create or replace function public.get_similar_tournament_decks(
  p_commander_key text,
  p_card_keys text[],
  p_start_date date default null,
  p_end_date date default null,
  p_minimum_tournament_size integer default null,
  p_maximum_standing integer default null,
  p_country_code text default null,
  p_state_region text default null,
  p_region_key text default null,
  p_is_online boolean default null,
  p_minimum_complete_decks integer default 1,
  p_similarity_limit integer default 20
)
returns table (
  tournament_deck_id uuid, tournament_name text, pilot_name text,
  standing integer, event_date timestamptz, region_key text,
  shared_card_count bigint, union_card_count bigint,
  similarity_rate numeric, source text, source_url text
)
language sql stable set search_path = ''
as $$
  with user_cards as (
    select distinct key
    from unnest(coalesce(p_card_keys, '{}'::text[])) key
    where length(trim(key)) > 0
  ),
  eligible as (
    select d.id, e.player_name, e.standing, t.name tournament_name,
      t.event_date, t.region_key, t.source, t.source_url
    from public.tournament_decks d
    join public.tournament_entries e on e.id = d.tournament_entry_id
    join public.tournaments t on t.id = e.tournament_id
    where d.commander_key = p_commander_key
      and d.parsing_status = 'complete'
      and (p_start_date is null or t.event_date >= p_start_date)
      and (p_end_date is null or t.event_date < p_end_date + 1)
      and (
        p_minimum_tournament_size is null or
        coalesce(t.player_count, 0) >= p_minimum_tournament_size
      )
      and (p_maximum_standing is null or e.standing <= p_maximum_standing)
      and (p_country_code is null or t.country_code = p_country_code)
      and (p_state_region is null or t.state_region = p_state_region)
      and (p_region_key is null or t.region_key = p_region_key)
      and (p_is_online is null or coalesce(t.is_online, false) = p_is_online)
  ),
  sample as (
    select * from eligible
    where (select count(*) from eligible) >= p_minimum_complete_decks
  ),
  deck_cards as (
    select distinct c.tournament_deck_id,
      case
        when c.oracle_id is not null then 'oracle:' || lower(c.oracle_id::text)
        else 'name:' || lower(trim(c.normalized_card_key))
      end identity_key
    from public.tournament_deck_card_details c
    join sample s on s.id = c.tournament_deck_id
    where c.board = 'mainboard'
  ),
  counts as (
    select s.*,
      count(distinct dc.identity_key)
        filter (where u.key is not null)::bigint shared_count,
      (
        select count(*)::bigint
        from (
          select identity_key from deck_cards x
          where x.tournament_deck_id = s.id
          union select key from user_cards
        ) union_keys
      ) union_count
    from sample s
    left join deck_cards dc on dc.tournament_deck_id = s.id
    left join user_cards u on u.key = dc.identity_key
    group by s.id, s.player_name, s.standing, s.tournament_name,
      s.event_date, s.region_key, s.source, s.source_url
  )
  select id, tournament_name, player_name, standing, event_date, region_key,
    shared_count, union_count,
    case when union_count = 0 then 0
      else shared_count::numeric / union_count end,
    source, source_url
  from counts
  order by
    case when union_count = 0 then 0
      else shared_count::numeric / union_count end desc,
    standing asc nulls last, event_date desc nulls last, id
  limit greatest(1, least(coalesce(p_similarity_limit, 20), 100));
$$;

grant execute on function public.get_commander_card_inclusion(
  text, timestamptz, timestamptz, integer, text, text, text, boolean,
  integer, integer
) to anon, authenticated;
grant execute on function public.get_deck_comparison_aggregate(
  text, date, date, integer, integer, text, text, text, boolean, integer
) to anon, authenticated;
grant execute on function public.get_similar_tournament_decks(
  text, text[], date, date, integer, integer, text, text, text, boolean,
  integer, integer
) to anon, authenticated;
