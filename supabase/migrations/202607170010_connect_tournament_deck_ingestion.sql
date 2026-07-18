-- A historical batch has two bounded stages. The cron worker imports provider
-- metadata first, then revisits the same date window until every available
-- decklist has been normalized.
alter table public.tournament_ingestion_batches
  add column if not exists stage text not null default 'tournaments'
    check (stage in ('tournaments', 'decks')),
  add column if not exists deck_entries_considered integer not null default 0,
  add column if not exists decks_inserted integer not null default 0,
  add column if not exists decks_updated integer not null default 0,
  add column if not exists decks_completed integer not null default 0,
  add column if not exists decks_partial integer not null default 0,
  add column if not exists decks_unavailable integer not null default 0;

create index if not exists tournament_ingestion_batches_stage_queue_idx
on public.tournament_ingestion_batches(status, stage, start_date);
