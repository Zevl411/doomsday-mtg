-- Durable jobs split historical imports into memory-safe provider requests.
create table if not exists public.tournament_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('topdeck', 'edhtop16')),
  start_date date not null,
  end_date date not null,
  window_days integer not null default 7 check (window_days between 1 and 15),
  minimum_players integer not null default 0 check (minimum_players >= 0),
  include_rounds boolean not null default false,
  enrich_location boolean not null default false,
  status text not null default 'pending' check (status in (
    'pending', 'running', 'completed', 'completed_with_errors',
    'paused', 'cancelled'
  )),
  total_batches integer not null default 0,
  completed_batches integer not null default 0,
  failed_batches integer not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.tournament_ingestion_batches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.tournament_ingestion_jobs(id)
    on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  )),
  attempts integer not null default 0,
  last_error text,
  tournaments_fetched integer not null default 0,
  tournaments_inserted integer not null default 0,
  tournaments_updated integer not null default 0,
  entries_fetched integer not null default 0,
  entries_inserted integer not null default 0,
  entries_updated integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (job_id, start_date, end_date),
  check (end_date >= start_date)
);

create index if not exists tournament_ingestion_jobs_status_idx
on public.tournament_ingestion_jobs(status, created_at);
create index if not exists tournament_ingestion_batches_queue_idx
on public.tournament_ingestion_batches(status, start_date);
create index if not exists tournament_ingestion_batches_job_idx
on public.tournament_ingestion_batches(job_id, status);

alter table public.tournament_ingestion_jobs enable row level security;
alter table public.tournament_ingestion_batches enable row level security;

drop policy if exists "Admins can read ingestion jobs"
on public.tournament_ingestion_jobs;
create policy "Admins can read ingestion jobs"
on public.tournament_ingestion_jobs for select to authenticated
using (exists (
  select 1 from public.admin_users
  where admin_users.user_id = (select auth.uid())
));

drop policy if exists "Admins can read ingestion batches"
on public.tournament_ingestion_batches;
create policy "Admins can read ingestion batches"
on public.tournament_ingestion_batches for select to authenticated
using (exists (
  select 1 from public.admin_users
  where admin_users.user_id = (select auth.uid())
));

revoke insert, update, delete on public.tournament_ingestion_jobs
from anon, authenticated;
revoke insert, update, delete on public.tournament_ingestion_batches
from anon, authenticated;
grant select on public.tournament_ingestion_jobs,
  public.tournament_ingestion_batches to authenticated;

create or replace function public.create_tournament_ingestion_batches(
  target_job_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_job public.tournament_ingestion_jobs;
  batch_count integer;
begin
  select * into selected_job
  from public.tournament_ingestion_jobs
  where id = target_job_id;
  if selected_job.id is null then raise exception 'Ingestion job not found'; end if;

  insert into public.tournament_ingestion_batches (job_id, start_date, end_date)
  select selected_job.id, batch_start::date,
    least(
      batch_start::date + selected_job.window_days - 1,
      selected_job.end_date
    )
  from generate_series(
    selected_job.start_date::timestamptz,
    selected_job.end_date::timestamptz,
    make_interval(days => selected_job.window_days)
  ) batch_start
  on conflict (job_id, start_date, end_date) do nothing;

  select count(*) into batch_count
  from public.tournament_ingestion_batches where job_id = selected_job.id;
  update public.tournament_ingestion_jobs
  set total_batches = batch_count, updated_at = now()
  where id = selected_job.id;
  return batch_count;
end;
$$;

create or replace function public.claim_tournament_ingestion_batch()
returns public.tournament_ingestion_batches
language plpgsql
security definer
set search_path = ''
as $$
declare claimed public.tournament_ingestion_batches;
begin
  -- Recover a worker interrupted by a platform limit.
  update public.tournament_ingestion_batches
  set status = case when attempts >= 3 then 'failed' else 'pending' end,
    last_error = 'Worker stopped before completing this batch.',
    updated_at = now()
  where status = 'running' and started_at < now() - interval '15 minutes';

  select batch.* into claimed
  from public.tournament_ingestion_batches batch
  join public.tournament_ingestion_jobs job on job.id = batch.job_id
  where batch.status = 'pending' and job.status in ('pending', 'running')
  order by job.created_at, batch.start_date
  for update of batch skip locked limit 1;
  if claimed.id is null then return null; end if;

  update public.tournament_ingestion_batches
  set status = 'running', attempts = attempts + 1,
    started_at = now(), updated_at = now()
  where id = claimed.id returning * into claimed;
  update public.tournament_ingestion_jobs
  set status = 'running', started_at = coalesce(started_at, now()),
    updated_at = now()
  where id = claimed.job_id;
  return claimed;
end;
$$;

create or replace function public.refresh_tournament_ingestion_job(
  target_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare totals record;
begin
  select count(*) total,
    count(*) filter (where status = 'completed') completed,
    count(*) filter (where status = 'failed') failed,
    count(*) filter (where status in ('pending', 'running')) unfinished
  into totals from public.tournament_ingestion_batches
  where job_id = target_job_id;

  update public.tournament_ingestion_jobs
  set total_batches = totals.total,
    completed_batches = totals.completed,
    failed_batches = totals.failed,
    status = case
      when status in ('paused', 'cancelled') then status
      when totals.unfinished = 0 and totals.failed > 0 then 'completed_with_errors'
      when totals.unfinished = 0 then 'completed'
      else 'running'
    end,
    completed_at = case when totals.unfinished = 0 then now() else null end,
    updated_at = now()
  where id = target_job_id;
end;
$$;

revoke all on function public.create_tournament_ingestion_batches(uuid)
from public, anon, authenticated;
revoke all on function public.claim_tournament_ingestion_batch()
from public, anon, authenticated;
revoke all on function public.refresh_tournament_ingestion_job(uuid)
from public, anon, authenticated;
grant execute on function public.create_tournament_ingestion_batches(uuid),
  public.claim_tournament_ingestion_batch(),
  public.refresh_tournament_ingestion_job(uuid) to service_role;
