-- Missing and external-URL-only Decks cannot enter card normalization. Mark
-- the entire bounded tournament window in one database statement so they do
-- not consume ten-entry Edge Function batches.
create or replace function public.mark_unavailable_tournament_decks(
  target_tournament_ids uuid[]
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with inserted as (
    insert into public.tournament_decks (
      tournament_entry_id,
      source,
      source_deck_id,
      commander_key,
      commander_name,
      parsing_status,
      parsing_issues,
      raw_decklist_available,
      structured_deck_available,
      imported_at
    )
    select
      entry.id,
      tournament.source,
      entry.source_entry_id,
      entry.commander_key,
      entry.commander_name,
      'unavailable',
      jsonb_build_array(jsonb_build_object(
        'code',
        case
          when entry.decklist_availability = 'url'
            then 'unavailable_external_decklist'
          else 'unavailable_decklist'
        end,
        'message',
        case
          when entry.decklist_availability = 'url'
            then 'The external decklist host is not supported for server-side normalization.'
          else 'No decklist is available for this entry.'
        end
      )),
      false,
      false,
      now()
    from public.tournament_entries entry
    join public.tournaments tournament on tournament.id = entry.tournament_id
    where entry.tournament_id = any(
      coalesce(target_tournament_ids, '{}'::uuid[])
    )
      and entry.decklist_availability in ('missing', 'url')
      and not exists (
        select 1 from public.tournament_decks existing
        where existing.tournament_entry_id = entry.id
      )
    on conflict (tournament_entry_id) do nothing
    returning 1
  )
  select count(*)::integer from inserted;
$$;

revoke all on function public.mark_unavailable_tournament_decks(uuid[])
from public, anon, authenticated;
grant execute on function public.mark_unavailable_tournament_decks(uuid[])
to service_role;
