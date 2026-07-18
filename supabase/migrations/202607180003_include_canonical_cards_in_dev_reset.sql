-- A development reset means the next ingestion should rebuild every layer,
-- including the persistent Scryfall identity cache.
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
  canonical_card_count bigint;
  canonical_alias_count bigint;
  ingestion_job_count bigint;
begin
  select count(*) into tournament_count from public.tournaments;
  select count(*) into entry_count from public.tournament_entries;
  select count(*) into normalized_deck_count from public.tournament_decks;
  select count(*) into normalized_card_count
  from public.tournament_deck_cards;
  select count(*) into canonical_card_count from public.canonical_cards;
  select count(*) into canonical_alias_count
  from public.canonical_card_aliases;
  select count(*) into ingestion_job_count
  from public.tournament_ingestion_jobs;

  delete from public.tournament_ingestion_jobs where id is not null;
  delete from public.tournaments where id is not null;
  -- Tournament rows are gone before canonical cards so no Deck-card foreign
  -- key can reference the cache. Aliases cascade with their canonical card.
  delete from public.canonical_cards where id is not null;

  return jsonb_build_object(
    'tournamentsDeleted', tournament_count,
    'entriesDeleted', entry_count,
    'normalizedDecksDeleted', normalized_deck_count,
    'normalizedCardsDeleted', normalized_card_count,
    'canonicalCardsDeleted', canonical_card_count,
    'canonicalAliasesDeleted', canonical_alias_count,
    'ingestionJobsDeleted', ingestion_job_count
  );
end;
$$;

revoke all on function public.clear_tournament_ingestion_data()
from public, anon, authenticated;
grant execute on function public.clear_tournament_ingestion_data()
to service_role;
