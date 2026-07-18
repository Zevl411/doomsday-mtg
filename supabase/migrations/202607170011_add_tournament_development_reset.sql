-- Development reset for administrators. User accounts, admin membership, and
-- user-owned Decks are intentionally outside this function's scope.
create or replace function public.clear_tournament_ingestion_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tournament_count bigint;
  entry_count bigint;
  normalized_deck_count bigint;
  normalized_card_count bigint;
  ingestion_job_count bigint;
begin
  select count(*) into tournament_count from public.tournaments;
  select count(*) into entry_count from public.tournament_entries;
  select count(*) into normalized_deck_count from public.tournament_decks;
  select count(*) into normalized_card_count
  from public.tournament_deck_cards;
  select count(*) into ingestion_job_count
  from public.tournament_ingestion_jobs;

  -- Jobs are removed first so the queue cannot claim additional pending work.
  delete from public.tournament_ingestion_jobs;
  -- Cascades remove entries, source links, normalized Decks, and Deck cards.
  delete from public.tournaments;

  return jsonb_build_object(
    'tournamentsDeleted', tournament_count,
    'entriesDeleted', entry_count,
    'normalizedDecksDeleted', normalized_deck_count,
    'normalizedCardsDeleted', normalized_card_count,
    'ingestionJobsDeleted', ingestion_job_count
  );
end;
$$;

revoke all on function public.clear_tournament_ingestion_data()
from public, anon, authenticated;
grant execute on function public.clear_tournament_ingestion_data()
to service_role;
