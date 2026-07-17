alter table public.tournament_ingestion_jobs
add column if not exists exclude_casual_events boolean not null default true;

comment on column public.tournament_ingestion_jobs.exclude_casual_events is
'Reject and purge events with explicit casual, budget, precon, or beginner title signals.';
