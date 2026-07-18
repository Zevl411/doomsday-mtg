-- Supabase's safe-update protection requires every DELETE to have an explicit
-- predicate, even inside this intentionally broad development reset.
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

  -- The non-null primary-key predicates deliberately select every row while
  -- satisfying the database's protection against accidental unfiltered DELETE.
  delete from public.tournament_ingestion_jobs where id is not null;
  delete from public.tournaments where id is not null;

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
