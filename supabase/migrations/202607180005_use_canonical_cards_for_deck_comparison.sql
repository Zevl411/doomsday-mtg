-- Comparison was introduced immediately before canonical card storage. Read
-- through the canonical compatibility view so newly normalized rows do not
-- depend on intentionally empty legacy card columns.
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
      and (
        p_is_online is null or
        coalesce(t.is_online, false) = p_is_online
      )
  ),
  totals as (
    select count(*)::bigint total,
      count(*) filter (where standing <= 16)::bigint top16,
      count(*) filter (where standing = 1)::bigint first_place
    from eligible
  ),
  card_rows as (
    select
      card.*,
      case
        when card.oracle_id is not null
          then 'oracle:' || lower(card.oracle_id::text)
        else 'name:' || lower(trim(card.normalized_card_key))
      end identity_key,
      eligible.standing
    from public.tournament_deck_card_details card
    join eligible on eligible.id = card.tournament_deck_id
    where card.board = 'mainboard'
  ),
  cards as (
    select
      identity_key,
      min(normalized_card_key) normalized_card_key,
      (array_agg(oracle_id) filter (where oracle_id is not null))[1] oracle_id,
      max(card_name) card_name,
      max(type_line) type_line,
      ((array_agg(color_identity::text))[1])::text[] color_identity,
      max(mana_value) mana_value,
      count(distinct tournament_deck_id)::bigint deck_count,
      avg(quantity)::numeric average_quantity,
      count(distinct tournament_deck_id)
        filter (where standing <= 16)::bigint top16_deck_count,
      count(distinct tournament_deck_id)
        filter (where standing = 1)::bigint first_place_deck_count
    from card_rows
    group by identity_key
  )
  select
    cards.normalized_card_key,
    cards.oracle_id,
    cards.card_name,
    cards.type_line,
    cards.color_identity,
    cards.mana_value,
    cards.deck_count,
    totals.total,
    case when totals.total = 0 then 0
      else cards.deck_count::numeric / totals.total end,
    cards.average_quantity,
    cards.top16_deck_count,
    case when totals.top16 = 0 then 0
      else cards.top16_deck_count::numeric / totals.top16 end,
    cards.first_place_deck_count,
    case when totals.first_place = 0 then 0
      else cards.first_place_deck_count::numeric / totals.first_place end
  from cards cross join totals
  where totals.total >= p_minimum_complete_decks
  order by cards.deck_count desc, cards.card_name;
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
  tournament_deck_id uuid,
  tournament_name text,
  pilot_name text,
  standing integer,
  event_date timestamptz,
  region_key text,
  shared_card_count bigint,
  union_card_count bigint,
  similarity_rate numeric,
  source text,
  source_url text
)
language sql stable set search_path = ''
as $$
  with user_cards as (
    select distinct key
    from unnest(coalesce(p_card_keys, '{}'::text[])) key
    where length(trim(key)) > 0
  ),
  eligible as (
    select
      deck.id,
      entry.player_name,
      entry.standing,
      tournament.name tournament_name,
      tournament.event_date,
      tournament.region_key,
      tournament.source,
      tournament.source_url
    from public.tournament_decks deck
    join public.tournament_entries entry
      on entry.id = deck.tournament_entry_id
    join public.tournaments tournament
      on tournament.id = entry.tournament_id
    where deck.commander_key = p_commander_key
      and deck.parsing_status = 'complete'
      and (
        p_start_date is null or
        tournament.event_date >= p_start_date
      )
      and (
        p_end_date is null or
        tournament.event_date < p_end_date + 1
      )
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
  sample as (
    select * from eligible
    where (select count(*) from eligible) >= p_minimum_complete_decks
  ),
  deck_cards as (
    select distinct
      card.tournament_deck_id,
      case
        when card.oracle_id is not null
          then 'oracle:' || lower(card.oracle_id::text)
        else 'name:' || lower(trim(card.normalized_card_key))
      end identity_key
    from public.tournament_deck_card_details card
    join sample on sample.id = card.tournament_deck_id
    where card.board = 'mainboard'
  ),
  counts as (
    select
      sample.*,
      count(distinct deck_cards.identity_key)
        filter (where user_cards.key is not null)::bigint shared_count,
      (
        select count(*)::bigint
        from (
          select compared.identity_key
          from deck_cards compared
          where compared.tournament_deck_id = sample.id
          union
          select key from user_cards
        ) union_keys
      ) union_count
    from sample
    left join deck_cards on deck_cards.tournament_deck_id = sample.id
    left join user_cards on user_cards.key = deck_cards.identity_key
    group by sample.id, sample.player_name, sample.standing,
      sample.tournament_name, sample.event_date, sample.region_key,
      sample.source, sample.source_url
  )
  select
    id,
    tournament_name,
    player_name,
    standing,
    event_date,
    region_key,
    shared_count,
    union_count,
    case when union_count = 0 then 0
      else shared_count::numeric / union_count end,
    source,
    source_url
  from counts
  order by
    case when union_count = 0 then 0
      else shared_count::numeric / union_count end desc,
    standing asc nulls last,
    event_date desc nulls last,
    id
  limit greatest(1, least(coalesce(p_similarity_limit, 20), 100));
$$;

grant execute on function public.get_deck_comparison_aggregate(
  text, date, date, integer, integer, text, text, text, boolean, integer
) to anon, authenticated;
grant execute on function public.get_similar_tournament_decks(
  text, text[], date, date, integer, integer, text, text, text, boolean,
  integer, integer
) to anon, authenticated;
