-- Materialize only absent candidate cards before building source/candidate
-- pairs. This keeps full 100-card personal Deck payloads within the API
-- statement budget.
create or replace function public.get_association_based_card_suggestions(
  p_commander_key text,
  p_source_oracle_ids uuid[],
  p_start_date date default null,
  p_end_date date default null,
  p_region_key text default null,
  p_minimum_tournament_size integer default 0,
  p_maximum_standing integer default null,
  p_minimum_sample_size integer default 20,
  p_minimum_occurrence_count integer default 3,
  p_minimum_confidence numeric default 0.05,
  p_minimum_lift numeric default 1,
  p_minimum_supporting_cards integer default 2,
  p_limit integer default 30
)
returns table (
  commander_key text,
  source_oracle_id uuid,
  source_card_name text,
  suggested_oracle_id uuid,
  suggested_card_name text,
  support numeric,
  confidence numeric,
  lift numeric,
  occurrence_count bigint,
  joint_deck_count bigint,
  source_deck_count bigint,
  sample_size bigint
)
language sql
stable
set search_path = ''
as $$
  with requested_sources as materialized (
    select canonical.id, canonical.oracle_id, canonical.card_name
    from public.canonical_cards canonical
    where canonical.oracle_id = any(
      coalesce(p_source_oracle_ids, '{}'::uuid[])
    )
  ),
  eligible as materialized (
    select deck.id
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
      and (
        p_region_key is null or tournament.region_key = p_region_key
      )
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
  deck_cards as materialized (
    select card.tournament_deck_id, card.canonical_card_id,
      sum(card.quantity)::bigint quantity
    from public.tournament_deck_cards card
    join eligible on eligible.id = card.tournament_deck_id
    join public.canonical_cards canonical
      on canonical.id = card.canonical_card_id
     and canonical.oracle_id is not null
    where card.board = 'mainboard'
    group by card.tournament_deck_id, card.canonical_card_id
  ),
  source_decks as materialized (
    select source.id source_card_id, source.oracle_id source_oracle_id,
      source.card_name source_card_name, card.tournament_deck_id,
      card.quantity
    from requested_sources source
    join deck_cards card on card.canonical_card_id = source.id
  ),
  source_totals as (
    select source_card_id, count(*)::bigint deck_count
    from source_decks
    group by source_card_id
  ),
  candidate_deck_cards as materialized (
    select card.*
    from deck_cards card
    left join requested_sources source
      on source.id = card.canonical_card_id
    where source.id is null
  ),
  candidate_totals as (
    select canonical_card_id, count(*)::bigint deck_count
    from candidate_deck_cards
    group by canonical_card_id
  ),
  joint as (
    select source.source_card_id, source.source_oracle_id,
      source.source_card_name,
      candidate.canonical_card_id suggested_card_id,
      count(*)::bigint joint_decks,
      sum(least(source.quantity, candidate.quantity))::bigint occurrences
    from source_decks source
    join candidate_deck_cards candidate
      on candidate.tournament_deck_id = source.tournament_deck_id
    group by source.source_card_id, source.source_oracle_id,
      source.source_card_name, candidate.canonical_card_id
  ),
  scored as materialized (
    select joint.*, source_totals.deck_count source_decks,
      candidate_totals.deck_count candidate_decks, sample.sample_size,
      joint.joint_decks::numeric /
        nullif(sample.sample_size, 0) support,
      joint.joint_decks::numeric /
        nullif(source_totals.deck_count, 0) confidence,
      (
        joint.joint_decks::numeric /
          nullif(source_totals.deck_count, 0)
      ) / nullif(
        candidate_totals.deck_count::numeric /
          nullif(sample.sample_size, 0),
        0
      ) lift
    from joint
    join source_totals using (source_card_id)
    join candidate_totals
      on candidate_totals.canonical_card_id = joint.suggested_card_id
    cross join sample
  ),
  thresholded as materialized (
    select scored.*
    from scored
    where scored.sample_size >= greatest(
        1, coalesce(p_minimum_sample_size, 20)
      )
      and scored.occurrences >= greatest(
        1, coalesce(p_minimum_occurrence_count, 3)
      )
      and scored.confidence >= greatest(
        0, coalesce(p_minimum_confidence, 0.05)
      )
      and scored.lift >= greatest(0, coalesce(p_minimum_lift, 1))
  ),
  ranked_candidates as (
    select thresholded.suggested_card_id,
      count(distinct thresholded.source_card_id)::bigint supporting_cards,
      sum(
        thresholded.confidence * least(thresholded.lift, 3)
      ) aggregate_evidence
    from thresholded
    group by thresholded.suggested_card_id
    having count(distinct thresholded.source_card_id) >= greatest(
      1, coalesce(p_minimum_supporting_cards, 2)
    )
    order by aggregate_evidence desc, supporting_cards desc,
      thresholded.suggested_card_id
    limit greatest(1, least(coalesce(p_limit, 30), 100))
  )
  select p_commander_key, thresholded.source_oracle_id,
    thresholded.source_card_name, suggested.oracle_id,
    suggested.card_name, thresholded.support, thresholded.confidence,
    thresholded.lift, thresholded.occurrences, thresholded.joint_decks,
    thresholded.source_decks, thresholded.sample_size
  from ranked_candidates
  join thresholded using (suggested_card_id)
  join public.canonical_cards suggested
    on suggested.id = thresholded.suggested_card_id
   and suggested.oracle_id is not null
  order by ranked_candidates.aggregate_evidence desc,
    ranked_candidates.supporting_cards desc, suggested.card_name,
    thresholded.confidence desc, thresholded.source_card_name;
$$;

grant execute on function public.get_association_based_card_suggestions(
  text, uuid[], date, date, text, integer, integer, integer, integer,
  numeric, numeric, integer, integer
) to anon, authenticated;

notify pgrst, 'reload schema';
