-- Similarity used to rebuild a UNION set by rescanning every sampled card row
-- once per eligible Deck. As tournament history grew, that became quadratic
-- enough to exceed PostgREST's statement timeout.

create index if not exists tournament_decks_commander_comparison_idx
on public.tournament_decks(commander_key, tournament_entry_id)
where parsing_status in ('complete', 'partial');

create index if not exists tournament_deck_cards_mainboard_cover_idx
on public.tournament_deck_cards(tournament_deck_id)
include (quantity, canonical_card_id, normalized_card_key, oracle_id)
where board = 'mainboard';

-- Eligibility only needs quantities, so avoid joining canonical card metadata
-- through tournament_deck_card_details for every candidate Deck.
create or replace view public.tournament_decks_for_comparison
with (security_invoker = true) as
select deck.*
from public.tournament_decks deck
where deck.parsing_status in ('complete', 'partial')
  and (
    select coalesce(sum(card.quantity), 0)
    from public.tournament_deck_cards card
    where card.tournament_deck_id = deck.id
      and card.board = 'mainboard'
  ) >= 25;

grant select on public.tournament_decks_for_comparison
to anon, authenticated;

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
  shared_card_count bigint, union_card_count bigint, similarity_rate numeric,
  source text, source_url text
)
language sql stable set search_path = ''
as $$
  with user_cards as materialized (
    select distinct trim(key) key
    from unnest(coalesce(p_card_keys, '{}'::text[])) key
    where length(trim(key)) > 0
  ),
  user_total as (
    select count(*)::bigint card_count from user_cards
  ),
  eligible as materialized (
    select deck.id, entry.player_name, entry.standing,
      tournament.name tournament_name, tournament.event_date,
      tournament.region_key, tournament.source, tournament.source_url
    from public.tournament_decks_for_comparison deck
    join public.tournament_entries entry
      on entry.id = deck.tournament_entry_id
    join public.tournaments tournament
      on tournament.id = entry.tournament_id
    where deck.commander_key = p_commander_key
      and (p_start_date is null or tournament.event_date >= p_start_date)
      and (p_end_date is null or tournament.event_date < p_end_date + 1)
      and (
        p_minimum_tournament_size is null or
        coalesce(tournament.player_count, 0) >= p_minimum_tournament_size
      )
      and (
        p_maximum_standing is null or
        entry.standing <= p_maximum_standing
      )
      and (
        p_country_code is null or
        tournament.country_code = p_country_code
      )
      and (
        p_state_region is null or
        tournament.state_region = p_state_region
      )
      and (
        p_region_key is null or
        tournament.region_key = p_region_key
      )
      and (
        p_is_online is null or
        coalesce(tournament.is_online, false) = p_is_online
      )
  ),
  sample_size as (
    select count(*)::bigint deck_count from eligible
  ),
  card_identities as (
    select card.tournament_deck_id,
      case when card.oracle_id is not null
        then 'oracle:' || lower(card.oracle_id::text)
        else 'name:' || lower(trim(card.normalized_card_key))
      end identity_key
    from public.tournament_deck_card_details card
    join eligible on eligible.id = card.tournament_deck_id
    where card.board = 'mainboard'
    group by card.tournament_deck_id,
      case when card.oracle_id is not null
        then 'oracle:' || lower(card.oracle_id::text)
        else 'name:' || lower(trim(card.normalized_card_key))
      end
  ),
  deck_metrics as (
    select card.tournament_deck_id,
      count(*)::bigint deck_card_count,
      count(*) filter (where user_card.key is not null)::bigint shared_count
    from card_identities card
    left join user_cards user_card on user_card.key = card.identity_key
    group by card.tournament_deck_id
  ),
  scored as (
    select eligible.*,
      deck_metrics.shared_count,
      (
        deck_metrics.deck_card_count + user_total.card_count -
        deck_metrics.shared_count
      )::bigint union_count
    from eligible
    join deck_metrics on deck_metrics.tournament_deck_id = eligible.id
    cross join user_total
    cross join sample_size
    where sample_size.deck_count >= greatest(
      1,
      coalesce(p_minimum_complete_decks, 1)
    )
  )
  select id, tournament_name, player_name, standing, event_date, region_key,
    shared_count, union_count,
    case when union_count = 0 then 0
      else shared_count::numeric / union_count end,
    source, source_url
  from scored
  order by
    case when union_count = 0 then 0
      else shared_count::numeric / union_count end desc,
    standing asc nulls last,
    event_date desc nulls last,
    id
  limit greatest(1, least(coalesce(p_similarity_limit, 20), 100));
$$;

grant execute on function public.get_similar_tournament_decks(
  text, text[], date, date, integer, integer, text, text, text, boolean,
  integer, integer
) to anon, authenticated;

notify pgrst, 'reload schema';
