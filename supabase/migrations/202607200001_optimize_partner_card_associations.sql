-- Association requests for popular partner pairings can cover many Decks.
-- Start from the selected source card instead of materializing every card in
-- every eligible Deck before narrowing the joint-card calculation.
create index if not exists tournament_cards_association_source_idx
on public.tournament_deck_cards(canonical_card_id, tournament_deck_id)
include (quantity)
where board = 'mainboard' and canonical_card_id is not null;

create or replace function public.get_commander_card_associations(
  p_commander_key text,
  p_source_oracle_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_region_key text default null,
  p_minimum_tournament_size integer default 0,
  p_maximum_standing integer default null,
  p_minimum_sample_size integer default 20,
  p_minimum_occurrence_count integer default 3,
  p_minimum_confidence numeric default 0,
  p_minimum_lift numeric default 0,
  p_limit integer default 100
)
returns table (
  commander_key text,
  source_oracle_id uuid,
  source_card_name text,
  associated_oracle_id uuid,
  associated_card_name text,
  support numeric,
  confidence numeric,
  lift numeric,
  occurrence_count bigint,
  deck_count bigint,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  sample_size bigint
)
language sql
stable
set search_path = ''
as $$
  with source_card as (
    select id, oracle_id, card_name
    from public.canonical_cards
    where oracle_id = p_source_oracle_id
  ),
  eligible as materialized (
    select deck.id, tournament.event_date
    from public.tournament_decks deck
    join public.tournament_entries entry
      on entry.id = deck.tournament_entry_id
    join public.tournaments tournament
      on tournament.id = entry.tournament_id
    where deck.commander_key = p_commander_key
      and deck.parsing_status = 'complete'
      and (p_start_date is null or tournament.event_date >= p_start_date)
      and (
        p_end_date is null or
        tournament.event_date < p_end_date + interval '1 day'
      )
      and (p_region_key is null or tournament.region_key = p_region_key)
      and coalesce(tournament.player_count, 0) >= greatest(
        0, coalesce(p_minimum_tournament_size, 0)
      )
      and (
        p_maximum_standing is null or
        entry.standing <= p_maximum_standing
      )
  ),
  sample as (
    select count(*)::bigint sample_size from eligible
  ),
  source_decks as materialized (
    select card.tournament_deck_id,
      sum(card.quantity)::bigint quantity
    from source_card
    join public.tournament_deck_cards card
      on card.canonical_card_id = source_card.id
     and card.board = 'mainboard'
    join eligible on eligible.id = card.tournament_deck_id
    group by card.tournament_deck_id
  ),
  source_total as (
    select count(*)::bigint deck_count from source_decks
  ),
  candidate_totals as materialized (
    select card.canonical_card_id,
      count(distinct card.tournament_deck_id)::bigint deck_count
    from eligible
    join public.tournament_deck_cards card
      on card.tournament_deck_id = eligible.id
     and card.board = 'mainboard'
     and card.canonical_card_id is not null
    join public.canonical_cards canonical
      on canonical.id = card.canonical_card_id
     and canonical.oracle_id is not null
    group by card.canonical_card_id
  ),
  joint as (
    select candidate.canonical_card_id,
      count(distinct candidate.tournament_deck_id)::bigint deck_count,
      sum(least(source.quantity, candidate.quantity))::bigint occurrences,
      min(eligible.event_date) first_seen,
      max(eligible.event_date) last_seen
    from source_decks source
    join public.tournament_deck_cards candidate
      on candidate.tournament_deck_id = source.tournament_deck_id
     and candidate.board = 'mainboard'
     and candidate.canonical_card_id is not null
    join source_card
      on source_card.id <> candidate.canonical_card_id
    join eligible on eligible.id = source.tournament_deck_id
    group by candidate.canonical_card_id
  ),
  scored as (
    select joint.*, candidate_totals.deck_count candidate_decks,
      sample.sample_size, source_total.deck_count source_decks,
      joint.deck_count::numeric / nullif(sample.sample_size, 0) support,
      joint.deck_count::numeric /
        nullif(source_total.deck_count, 0) confidence,
      (
        joint.deck_count::numeric / nullif(source_total.deck_count, 0)
      ) / nullif(
        candidate_totals.deck_count::numeric /
          nullif(sample.sample_size, 0),
        0
      ) lift
    from joint
    join candidate_totals using (canonical_card_id)
    cross join sample
    cross join source_total
  )
  select p_commander_key, source.oracle_id, source.card_name,
    associated.oracle_id, associated.card_name,
    scored.support, scored.confidence, scored.lift,
    scored.occurrences, scored.deck_count, scored.first_seen,
    scored.last_seen, scored.sample_size
  from scored
  cross join source_card source
  join public.canonical_cards associated
    on associated.id = scored.canonical_card_id
   and associated.oracle_id is not null
  where scored.sample_size >= greatest(
      1, coalesce(p_minimum_sample_size, 20)
    )
    and scored.occurrences >= greatest(
      1, coalesce(p_minimum_occurrence_count, 3)
    )
    and scored.confidence >= greatest(
      0, coalesce(p_minimum_confidence, 0)
    )
    and scored.lift >= greatest(0, coalesce(p_minimum_lift, 0))
  order by scored.lift desc, scored.confidence desc,
    scored.deck_count desc, associated.card_name
  limit greatest(1, least(coalesce(p_limit, 100), 250));
$$;

grant execute on function public.get_commander_card_associations(
  text, uuid, date, date, text, integer, integer, integer, integer,
  numeric, numeric, integer
) to anon, authenticated;

notify pgrst, 'reload schema';
