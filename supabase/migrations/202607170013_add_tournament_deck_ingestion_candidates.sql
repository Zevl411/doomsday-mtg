-- Select candidate IDs in SQL so the Edge Function never relies on ambiguous
-- PostgREST filtering across an embedded one-to-one relation.
create or replace function public.get_tournament_deck_ingestion_candidates(
  target_tournament_ids uuid[],
  target_entry_ids uuid[] default null,
  target_commander_key text default null,
  include_partial boolean default false,
  result_limit integer default 10
)
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select entry.id
  from public.tournament_entries entry
  left join public.tournament_decks deck
    on deck.tournament_entry_id = entry.id
  where entry.tournament_id = any(target_tournament_ids)
    and (
      target_entry_ids is null
      or entry.id = any(target_entry_ids)
    )
    and (
      target_commander_key is null
      or entry.commander_key = target_commander_key
    )
    and (
      deck.id is null
      or (include_partial and deck.parsing_status = 'partial')
    )
  order by entry.created_at, entry.id
  limit least(greatest(result_limit, 1), 100);
$$;

revoke all on function public.get_tournament_deck_ingestion_candidates(
  uuid[], uuid[], text, boolean, integer
) from public, anon, authenticated;
grant execute on function public.get_tournament_deck_ingestion_candidates(
  uuid[], uuid[], text, boolean, integer
) to service_role;
