-- Commander event filtering uses complete normalized Decks and requires every
-- selected Oracle identity to appear in the same mainboard.
create or replace function public.get_commander_deck_events_by_cards(
  p_commander_key text,
  p_oracle_ids uuid[],
  p_limit integer default 100
)
returns table (
  tournament_entry_id uuid,
  tournament_id uuid,
  tournament_deck_id uuid,
  tournament_name text,
  event_date timestamptz,
  player_name text,
  standing integer,
  wins integer,
  losses integer,
  draws integer
)
language sql
stable
set search_path = ''
as $$
  with requested as materialized (
    select distinct oracle_id
    from unnest(coalesce(p_oracle_ids, '{}'::uuid[])) oracle_id
  ),
  matched_decks as (
    select deck.id
    from public.tournament_decks deck
    join public.tournament_deck_cards card
      on card.tournament_deck_id = deck.id
     and card.board = 'mainboard'
    join public.canonical_cards canonical
      on canonical.id = card.canonical_card_id
    join requested on requested.oracle_id = canonical.oracle_id
    where deck.commander_key = p_commander_key
      and deck.parsing_status = 'complete'
    group by deck.id
    having count(distinct canonical.oracle_id) =
      (select count(*) from requested)
  )
  select entry.id, entry.tournament_id, deck.id, tournament.name,
    tournament.event_date, entry.player_name, entry.standing,
    entry.wins, entry.losses, entry.draws
  from matched_decks matched
  join public.tournament_decks deck on deck.id = matched.id
  join public.tournament_entries entry
    on entry.id = deck.tournament_entry_id
  join public.tournaments tournament
    on tournament.id = entry.tournament_id
  where exists (select 1 from requested)
  order by tournament.event_date desc nulls last,
    entry.standing asc nulls last, entry.id
  limit greatest(1, least(coalesce(p_limit, 100), 250));
$$;

grant execute on function public.get_commander_deck_events_by_cards(
  text, uuid[], integer
) to anon, authenticated;

notify pgrst, 'reload schema';
