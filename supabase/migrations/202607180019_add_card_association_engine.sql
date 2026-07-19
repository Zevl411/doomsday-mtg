-- Card associations are descriptive co-occurrence statistics. They are not
-- recommendations and must never be interpreted as evidence of causation.
create table if not exists public.commander_card_associations (
  commander_key text not null,
  source_card_id uuid not null
    references public.canonical_cards(id) on delete cascade,
  associated_card_id uuid not null
    references public.canonical_cards(id) on delete cascade,
  occurrence_count bigint not null check (occurrence_count >= 0),
  deck_count bigint not null check (deck_count >= 0),
  source_deck_count bigint not null check (source_deck_count >= deck_count),
  associated_deck_count bigint not null
    check (associated_deck_count >= deck_count),
  sample_size bigint not null check (sample_size >= source_deck_count),
  support numeric not null check (support between 0 and 1),
  confidence numeric not null check (confidence between 0 and 1),
  lift numeric not null check (lift >= 0),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  refreshed_at timestamptz not null default now(),
  primary key (commander_key, source_card_id, associated_card_id),
  check (source_card_id <> associated_card_id)
);

alter table public.commander_card_associations enable row level security;
drop policy if exists "Card associations are publicly readable"
on public.commander_card_associations;
create policy "Card associations are publicly readable"
on public.commander_card_associations for select
to anon, authenticated using (true);
grant select on public.commander_card_associations to anon, authenticated;
revoke insert, update, delete on public.commander_card_associations
from anon, authenticated;

create index if not exists commander_card_associations_source_score_idx
on public.commander_card_associations(
  commander_key, source_card_id, lift desc, confidence desc
);
create index if not exists commander_card_associations_target_idx
on public.commander_card_associations(
  commander_key, associated_card_id
);

-- These partial covering indexes constrain association work to complete
-- normalized mainboards before PostgreSQL touches card rows.
create index if not exists tournament_decks_complete_association_idx
on public.tournament_decks(commander_key, tournament_entry_id, id)
where parsing_status = 'complete';
create index if not exists tournament_cards_mainboard_association_idx
on public.tournament_deck_cards(tournament_deck_id, canonical_card_id)
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
    select deck_cards.tournament_deck_id, deck_cards.quantity
    from deck_cards
    join source_card on source_card.id = deck_cards.canonical_card_id
  ),
  source_total as (
    select count(*)::bigint deck_count from source_decks
  ),
  candidate_totals as (
    select canonical_card_id, count(*)::bigint deck_count
    from deck_cards
    group by canonical_card_id
  ),
  joint as (
    select candidate.canonical_card_id,
      count(*)::bigint deck_count,
      sum(least(source.quantity, candidate.quantity))::bigint occurrences,
      min(eligible.event_date) first_seen,
      max(eligible.event_date) last_seen
    from source_decks source
    join deck_cards candidate
      on candidate.tournament_deck_id = source.tournament_deck_id
    join eligible on eligible.id = source.tournament_deck_id
    join source_card
      on source_card.id <> candidate.canonical_card_id
    group by candidate.canonical_card_id
  ),
  scored as (
    select joint.*, candidate_totals.deck_count candidate_decks,
      sample.sample_size, source_total.deck_count source_decks,
      joint.deck_count::numeric / nullif(sample.sample_size, 0) support,
      joint.deck_count::numeric / nullif(source_total.deck_count, 0) confidence,
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
    and scored.confidence >= greatest(0, coalesce(p_minimum_confidence, 0))
    and scored.lift >= greatest(0, coalesce(p_minimum_lift, 0))
  order by scored.lift desc, scored.confidence desc,
    scored.deck_count desc, associated.card_name
  limit greatest(1, least(coalesce(p_limit, 100), 250));
$$;

grant execute on function public.get_commander_card_associations(
  text, uuid, date, date, text, integer, integer, integer, integer,
  numeric, numeric, integer
) to anon, authenticated;

-- Refreshes a reusable all-time baseline. Filtered requests use the bounded
-- source-card RPC above so they do not rebuild every possible pair.
create or replace function public.refresh_commander_card_associations(
  p_commander_key text,
  p_minimum_sample_size integer default 20,
  p_minimum_occurrence_count integer default 3
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count bigint;
begin
  if auth.role() <> 'service_role' and not exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access required.'
      using errcode = '42501';
  end if;

  delete from public.commander_card_associations
  where commander_key = p_commander_key;

  insert into public.commander_card_associations (
    commander_key, source_card_id, associated_card_id,
    occurrence_count, deck_count, source_deck_count,
    associated_deck_count, sample_size, support, confidence, lift,
    first_seen_at, last_seen_at
  )
  with eligible as materialized (
    select deck.id, tournament.event_date
    from public.tournament_decks deck
    join public.tournament_entries entry
      on entry.id = deck.tournament_entry_id
    join public.tournaments tournament
      on tournament.id = entry.tournament_id
    where deck.commander_key = p_commander_key
      and deck.parsing_status = 'complete'
  ),
  sample as (
    select count(*)::bigint total from eligible
  ),
  cards as materialized (
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
  totals as (
    select canonical_card_id, count(*)::bigint decks
    from cards group by canonical_card_id
  ),
  pairs as (
    select source.canonical_card_id source_id,
      associated.canonical_card_id associated_id,
      sum(least(source.quantity, associated.quantity))::bigint occurrences,
      count(*)::bigint decks,
      min(eligible.event_date) first_seen,
      max(eligible.event_date) last_seen
    from cards source
    join cards associated
      on associated.tournament_deck_id = source.tournament_deck_id
     and associated.canonical_card_id <> source.canonical_card_id
    join eligible on eligible.id = source.tournament_deck_id
    group by source.canonical_card_id, associated.canonical_card_id
  )
  select p_commander_key, pairs.source_id, pairs.associated_id,
    pairs.occurrences, pairs.decks, source_total.decks,
    associated_total.decks, sample.total,
    pairs.decks::numeric / sample.total,
    pairs.decks::numeric / source_total.decks,
    (pairs.decks::numeric / source_total.decks) /
      (associated_total.decks::numeric / sample.total),
    pairs.first_seen, pairs.last_seen
  from pairs
  join totals source_total on source_total.canonical_card_id = pairs.source_id
  join totals associated_total
    on associated_total.canonical_card_id = pairs.associated_id
  cross join sample
  where sample.total >= greatest(
      1, coalesce(p_minimum_sample_size, 20)
    )
    and pairs.occurrences >= greatest(
      1, coalesce(p_minimum_occurrence_count, 3)
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.refresh_commander_card_associations(
  text, integer, integer
) from public, anon;
grant execute on function public.refresh_commander_card_associations(
  text, integer, integer
) to authenticated, service_role;

-- Overlapping ego clusters are intentional groundwork. They identify connected
-- groups without inventing package names or recommendation semantics.
create or replace function public.get_commander_card_association_clusters(
  p_commander_key text,
  p_minimum_deck_count integer default 5,
  p_minimum_confidence numeric default 0.2,
  p_minimum_lift numeric default 1.1,
  p_limit integer default 25
)
returns table (
  cluster_id uuid,
  member_oracle_ids uuid[],
  connection_count bigint,
  average_lift numeric,
  sample_size bigint
)
language sql
stable
set search_path = ''
as $$
  with strong as (
    select association.*
    from public.commander_card_associations association
    where association.commander_key = p_commander_key
      and association.deck_count >= greatest(
        1, coalesce(p_minimum_deck_count, 5)
      )
      and association.confidence >= greatest(
        0, coalesce(p_minimum_confidence, 0.2)
      )
      and association.lift >= greatest(0, coalesce(p_minimum_lift, 1.1))
  ),
  grouped as (
    select strong.source_card_id,
      array_agg(distinct canonical.oracle_id)
        filter (where canonical.oracle_id is not null) member_ids,
      count(distinct strong.associated_card_id)::bigint connections,
      avg(strong.lift) average_lift,
      max(strong.sample_size)::bigint sample_size
    from strong
    join public.canonical_cards canonical
      on canonical.id in (strong.source_card_id, strong.associated_card_id)
    group by strong.source_card_id
  )
  select source.oracle_id, grouped.member_ids, grouped.connections,
    grouped.average_lift, grouped.sample_size
  from grouped
  join public.canonical_cards source on source.id = grouped.source_card_id
  where source.oracle_id is not null
    and cardinality(grouped.member_ids) >= 3
  order by grouped.average_lift desc, grouped.connections desc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

grant execute on function public.get_commander_card_association_clusters(
  text, integer, numeric, numeric, integer
) to anon, authenticated;

notify pgrst, 'reload schema';
