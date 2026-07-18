-- Production diagnostics stay server-side so the admin browser receives
-- bounded aggregates instead of scanning tournament or provider payload rows.
alter table public.tournament_ingestion_batches
  add column if not exists tournaments_excluded integer not null default 0;

drop index if exists public.tournament_entries_commander_key_idx;
create index if not exists tournament_entries_commander_tournament_idx
on public.tournament_entries(commander_key, tournament_id);

create index if not exists tournament_decks_status_commander_idx
on public.tournament_decks(parsing_status, commander_key);

create index if not exists tournament_ingestion_jobs_status_updated_idx
on public.tournament_ingestion_jobs(status, updated_at desc);

create or replace function public.get_data_health_summary()
returns table (
  tournament_count bigint,
  entry_count bigint,
  topdeck_tournament_count bigint,
  edhtop16_tournament_count bigint,
  topdeck_entry_count bigint,
  edhtop16_entry_count bigint,
  first_event_date timestamptz,
  latest_event_date timestamptz,
  tournament_with_location_count bigint,
  tournament_without_location_count bigint,
  tournament_missing_date_count bigint,
  excluded_casual_event_count bigint,
  structured_entry_count bigint,
  plaintext_entry_count bigint,
  url_only_entry_count bigint,
  missing_decklist_entry_count bigint,
  normalized_deck_count bigint,
  complete_deck_count bigint,
  partial_deck_count bigint,
  unavailable_deck_count bigint,
  invalid_deck_count bigint,
  canonical_card_count bigint,
  canonical_alias_count bigint,
  canonical_with_oracle_count bigint,
  fallback_identity_count bigint,
  unresolved_card_row_count bigint,
  tournament_card_count bigint,
  tournament_card_without_canonical_count bigint,
  suspicious_alias_count bigint,
  commander_with_one_complete_count bigint,
  commander_with_five_complete_count bigint,
  commander_with_twenty_complete_count bigint,
  commander_with_fifty_complete_count bigint,
  commander_without_complete_count bigint,
  paired_commander_sample_count bigint,
  regional_complete_deck_count bigint,
  possible_match_count bigint,
  linked_event_count bigint,
  pending_job_count bigint,
  running_job_count bigint,
  failed_job_count bigint,
  paused_job_count bigint,
  completed_job_count bigint,
  stale_job_count bigint,
  last_successful_tournament_ingestion timestamptz,
  last_successful_deck_normalization timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access required.'
      using errcode = '42501';
  end if;

  return query
  with tournament_stats as (
    select count(*)::bigint total,
      count(*) filter (where source = 'topdeck')::bigint topdeck,
      count(*) filter (where source = 'edhtop16')::bigint edhtop16,
      min(event_date) first_date, max(event_date) latest_date,
      count(*) filter (
        where coalesce(region_key, 'unknown') <> 'unknown'
      )::bigint with_location,
      count(*) filter (
        where coalesce(region_key, 'unknown') = 'unknown'
      )::bigint without_location,
      count(*) filter (where event_date is null)::bigint missing_date
    from public.tournaments
  ),
  entry_stats as (
    select count(*)::bigint total,
      count(*) filter (where tournament.source = 'topdeck')::bigint topdeck,
      count(*) filter (where tournament.source = 'edhtop16')::bigint edhtop16,
      count(*) filter (
        where decklist_availability = 'structured'
      )::bigint structured,
      count(*) filter (
        where decklist_availability = 'plaintext'
      )::bigint plaintext,
      count(*) filter (
        where decklist_availability = 'url'
      )::bigint url_only,
      count(*) filter (
        where decklist_availability = 'missing'
          or decklist_availability is null
      )::bigint missing
    from public.tournament_entries entry
    join public.tournaments tournament on tournament.id = entry.tournament_id
  ),
  deck_stats as (
    select count(*)::bigint total,
      count(*) filter (where parsing_status = 'complete')::bigint complete,
      count(*) filter (where parsing_status = 'partial')::bigint partial,
      count(*) filter (where parsing_status = 'unavailable')::bigint unavailable,
      count(*) filter (where parsing_status = 'invalid')::bigint invalid,
      coalesce(sum((
        select count(*)
        from jsonb_array_elements(
          coalesce(parsing_issues, '[]'::jsonb)
        ) issue
        where issue->>'code' = 'unknown_card'
      )), 0)::bigint unresolved
    from public.tournament_decks
  ),
  card_stats as (
    select count(*)::bigint total,
      count(*) filter (where canonical_card_id is null)::bigint unlinked
    from public.tournament_deck_cards
  ),
  canonical_stats as (
    select count(*)::bigint total,
      count(*) filter (where oracle_id is not null)::bigint with_oracle,
      count(*) filter (where oracle_id is null)::bigint fallback
    from public.canonical_cards
  ),
  suspicious_aliases as (
    select count(*)::bigint total
    from (
      select canonical_card_id
      from public.canonical_card_aliases
      group by canonical_card_id
      having count(*) > 12
      union all
      select alias.canonical_card_id
      from public.canonical_card_aliases alias
      join public.canonical_cards canonical_name
        on canonical_name.normalized_card_key = alias.normalized_card_key
       and canonical_name.id <> alias.canonical_card_id
    ) suspicious
  ),
  commander_samples as (
    select entry.commander_key,
      count(*) filter (where deck.parsing_status = 'complete')::bigint complete
    from public.tournament_entries entry
    left join public.tournament_decks deck
      on deck.tournament_entry_id = entry.id
    where length(trim(entry.commander_key)) > 0
      and entry.commander_key <> 'unknown-commander'
    group by entry.commander_key
  ),
  analytics_stats as (
    select
      count(*) filter (where complete >= 1)::bigint with_one,
      count(*) filter (where complete >= 5)::bigint with_five,
      count(*) filter (where complete >= 20)::bigint with_twenty,
      count(*) filter (where complete >= 50)::bigint with_fifty,
      count(*) filter (where complete = 0)::bigint without_complete,
      count(*) filter (
        where complete >= 1 and commander_key like '% // %'
      )::bigint paired
    from commander_samples
  ),
  job_stats as (
    select
      count(*) filter (where status = 'pending')::bigint pending,
      count(*) filter (where status = 'running')::bigint running,
      count(*) filter (
        where status = 'completed_with_errors'
      )::bigint failed,
      count(*) filter (where status = 'paused')::bigint paused,
      count(*) filter (where status = 'completed')::bigint completed,
      count(*) filter (
        where status in ('pending', 'running')
          and updated_at < now() - interval '20 minutes'
      )::bigint stale
    from public.tournament_ingestion_jobs
  )
  select tournament_stats.total, entry_stats.total,
    tournament_stats.topdeck, tournament_stats.edhtop16,
    entry_stats.topdeck, entry_stats.edhtop16,
    tournament_stats.first_date, tournament_stats.latest_date,
    tournament_stats.with_location, tournament_stats.without_location,
    tournament_stats.missing_date,
    (
      select coalesce(sum(tournaments_excluded), 0)::bigint
      from public.tournament_ingestion_batches
    ),
    entry_stats.structured, entry_stats.plaintext, entry_stats.url_only,
    entry_stats.missing, deck_stats.total, deck_stats.complete,
    deck_stats.partial, deck_stats.unavailable, deck_stats.invalid,
    canonical_stats.total,
    (select count(*)::bigint from public.canonical_card_aliases),
    canonical_stats.with_oracle, canonical_stats.fallback,
    deck_stats.unresolved, card_stats.total, card_stats.unlinked,
    suspicious_aliases.total,
    analytics_stats.with_one, analytics_stats.with_five,
    analytics_stats.with_twenty, analytics_stats.with_fifty,
    analytics_stats.without_complete, analytics_stats.paired,
    (
      select count(*)::bigint
      from public.tournament_decks deck
      join public.tournament_entries entry
        on entry.id = deck.tournament_entry_id
      join public.tournaments tournament
        on tournament.id = entry.tournament_id
      where deck.parsing_status = 'complete'
        and coalesce(tournament.region_key, 'unknown') <> 'unknown'
    ),
    (select count(*)::bigint from public.possible_tournament_matches),
    (select count(*)::bigint from public.tournament_source_links),
    job_stats.pending, job_stats.running, job_stats.failed, job_stats.paused,
    job_stats.completed, job_stats.stale,
    (
      select max(completed_at)
      from public.tournament_ingestion_batches
      where status = 'completed' and stage = 'tournaments'
    ),
    (
      select max(completed_at)
      from public.tournament_ingestion_batches
      where status = 'completed' and stage = 'decks'
    )
  from tournament_stats, entry_stats, deck_stats, card_stats,
    canonical_stats, suspicious_aliases, analytics_stats, job_stats;
end;
$$;

create or replace function public.get_data_health_region_coverage(
  p_limit integer default 50
)
returns table (
  region_key text,
  tournament_count bigint,
  entry_count bigint,
  complete_deck_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access required.'
      using errcode = '42501';
  end if;

  return query
  select tournament.region_key,
    count(distinct tournament.id)::bigint,
    count(distinct entry.id)::bigint,
    count(distinct deck.id) filter (
      where deck.parsing_status = 'complete'
    )::bigint
  from public.tournaments tournament
  left join public.tournament_entries entry
    on entry.tournament_id = tournament.id
  left join public.tournament_decks deck
    on deck.tournament_entry_id = entry.id
  where coalesce(tournament.region_key, 'unknown') <> 'unknown'
  group by tournament.region_key
  order by count(distinct tournament.id) desc, tournament.region_key
  limit greatest(1, least(coalesce(p_limit, 50), 250));
end;
$$;

create or replace function public.get_commander_analytics_readiness(
  p_minimum_complete_decks integer default 0,
  p_sample_status text default null,
  p_paired_only boolean default false,
  p_provider text default null,
  p_region_key text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_limit integer default 100
)
returns table (
  commander_key text,
  commander_name text,
  complete_deck_count bigint,
  partial_deck_count bigint,
  unavailable_deck_count bigint,
  tournament_count bigint,
  entry_count bigint,
  first_event_date timestamptz,
  latest_event_date timestamptz,
  country_count bigint,
  state_region_count bigint,
  paired_commander boolean,
  inclusion_ready boolean,
  comparison_ready boolean,
  sample_status text,
  top16_sample_count bigint,
  first_place_sample_count bigint,
  regional_sample_count bigint,
  unresolved_card_rate numeric,
  representative_deck_id uuid,
  alias_mismatch_count bigint,
  one_sided_extraction_failure_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access required.'
      using errcode = '42501';
  end if;

  return query
  with filtered_entries as (
    select entry.*, tournament.source, tournament.event_date,
      tournament.country_code, tournament.state_region,
      tournament.region_key
    from public.tournament_entries entry
    join public.tournaments tournament on tournament.id = entry.tournament_id
    where (p_provider is null or tournament.source = p_provider)
      and (p_region_key is null or tournament.region_key = p_region_key)
      and (p_start_date is null or tournament.event_date >= p_start_date)
      and (p_end_date is null or tournament.event_date < p_end_date + 1)
  ),
  grouped as (
    select entry.commander_key,
      max(entry.commander_name) commander_name,
      count(*) filter (where deck.parsing_status = 'complete')::bigint complete,
      count(*) filter (where deck.parsing_status = 'partial')::bigint partial,
      count(*) filter (
        where deck.parsing_status = 'unavailable'
      )::bigint unavailable,
      count(distinct entry.tournament_id)::bigint tournaments,
      count(*)::bigint entries,
      min(entry.event_date) first_date,
      max(entry.event_date) latest_date,
      count(distinct entry.country_code) filter (
        where entry.country_code is not null
      )::bigint countries,
      count(distinct entry.state_region) filter (
        where entry.state_region is not null
      )::bigint states,
      entry.commander_key like '% // %' paired,
      count(*) filter (
        where deck.parsing_status = 'complete' and entry.standing <= 16
      )::bigint top16,
      count(*) filter (
        where deck.parsing_status = 'complete' and entry.standing = 1
      )::bigint first_place,
      count(distinct entry.region_key) filter (
        where deck.parsing_status = 'complete'
          and coalesce(entry.region_key, 'unknown') <> 'unknown'
      )::bigint regions,
      (array_agg(deck.id order by deck.created_at, deck.id) filter (
        where deck.parsing_status = 'complete'
      ))[1] representative,
      count(*) filter (
        where entry.commander_key not like '% // %'
          and entry.commander_name ~* '(//|[[:space:]]with[[:space:]]|[[:space:]]and[[:space:]])'
      )::bigint one_sided,
      count(*) filter (
        where deck.parsing_issues @> '[{"code":"unknown_card"}]'
      )::numeric unresolved_decks
    from filtered_entries entry
    left join public.tournament_decks deck
      on deck.tournament_entry_id = entry.id
    where length(trim(entry.commander_key)) > 0
      and entry.commander_key <> 'unknown-commander'
    group by entry.commander_key
  ),
  classified as (
    select grouped.*,
      case when complete = 0 then 'unavailable'
        when complete < 5 then 'insufficient'
        when complete < 20 then 'limited'
        else 'sufficient' end status
    from grouped
  )
  select classified.commander_key, classified.commander_name,
    classified.complete, classified.partial, classified.unavailable,
    classified.tournaments, classified.entries, classified.first_date,
    classified.latest_date, classified.countries, classified.states,
    classified.paired, classified.complete >= 1, classified.complete >= 5,
    classified.status, classified.top16, classified.first_place,
    classified.regions,
    case when classified.entries = 0 then 0
      else classified.unresolved_decks / classified.entries end,
    classified.representative, 0::bigint, classified.one_sided
  from classified
  where classified.complete >= greatest(0, p_minimum_complete_decks)
    and (p_sample_status is null or classified.status = p_sample_status)
    and (not p_paired_only or classified.paired)
  order by classified.complete desc, classified.commander_name
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create or replace function public.get_unresolved_card_health(
  p_minimum_occurrences integer default 1,
  p_provider text default null,
  p_issue_code text default 'unknown_card',
  p_limit integer default 100
)
returns table (
  normalized_name text,
  display_name text,
  occurrence_count bigint,
  affected_deck_count bigint,
  affected_commander_count bigint,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  sample_issue_code text,
  provider_breakdown jsonb,
  current_alias_match boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access required.'
      using errcode = '42501';
  end if;

  return query
  with issues as (
    select deck.id deck_id, deck.commander_key, deck.created_at,
      tournament.source,
      issue->>'code' issue_code,
      regexp_replace(
        coalesce(issue->>'message', ''),
        '^Scryfall could not resolve (.+)\.$',
        '\1'
      ) display_name
    from public.tournament_decks deck
    join public.tournament_entries entry
      on entry.id = deck.tournament_entry_id
    join public.tournaments tournament
      on tournament.id = entry.tournament_id
    cross join lateral jsonb_array_elements(
      coalesce(deck.parsing_issues, '[]'::jsonb)
    ) issue
    where issue->>'code' = coalesce(p_issue_code, 'unknown_card')
      and (p_provider is null or tournament.source = p_provider)
  ),
  normalized as (
    select lower(
        regexp_replace(trim(issues.display_name), '\s+', ' ', 'g')
      ) key,
      issues.display_name, issues.deck_id, issues.commander_key,
      issues.created_at, issues.source, issues.issue_code
    from issues
    where length(trim(issues.display_name)) > 0
  ),
  grouped as (
    select normalized.key, max(normalized.display_name) display_name,
      count(*)::bigint occurrences,
      count(distinct normalized.deck_id)::bigint decks,
      count(distinct normalized.commander_key)::bigint commanders,
      min(normalized.created_at) first_seen,
      max(normalized.created_at) last_seen,
      max(normalized.issue_code) issue_code
    from normalized
    group by normalized.key
  ),
  provider_counts as (
    select normalized.key, normalized.source,
      count(*)::bigint occurrences
    from normalized
    group by normalized.key, normalized.source
  )
  select grouped.key, grouped.display_name, grouped.occurrences,
    grouped.decks, grouped.commanders, grouped.first_seen,
    grouped.last_seen, grouped.issue_code,
    coalesce((
      select jsonb_object_agg(
        provider_counts.source,
        provider_counts.occurrences
      )
      from provider_counts
      where provider_counts.key = grouped.key
    ), '{}'::jsonb),
    exists (
      select 1 from public.canonical_card_aliases alias
      where alias.normalized_card_key = grouped.key
    )
  from grouped
  where grouped.occurrences >= greatest(1, p_minimum_occurrences)
  order by grouped.occurrences desc, grouped.display_name
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create or replace function public.get_ingestion_job_health(
  p_status text default null,
  p_stage text default null,
  p_updated_since timestamptz default null,
  p_limit integer default 100
)
returns table (
  job_id uuid,
  provider text,
  job_status text,
  stage text,
  start_date date,
  end_date date,
  attempts integer,
  updated_at timestamptz,
  last_error text,
  stale boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access required.'
      using errcode = '42501';
  end if;

  return query
  select job.id, job.provider, job.status, batch.stage,
    batch.start_date, batch.end_date, batch.attempts,
    greatest(job.updated_at, batch.updated_at), batch.last_error,
    (
      batch.status in ('pending', 'running')
      and batch.updated_at < now() - interval '20 minutes'
    )
  from public.tournament_ingestion_jobs job
  join public.tournament_ingestion_batches batch on batch.job_id = job.id
  where (p_status is null or job.status = p_status)
    and (p_stage is null or batch.stage = p_stage)
    and (
      p_updated_since is null or
      greatest(job.updated_at, batch.updated_at) >= p_updated_since
    )
  order by greatest(job.updated_at, batch.updated_at) desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

revoke all on function public.get_data_health_summary() from public, anon;
revoke all on function public.get_data_health_region_coverage(integer)
from public, anon;
revoke all on function public.get_commander_analytics_readiness(
  integer, text, boolean, text, text, date, date, integer
) from public, anon;
revoke all on function public.get_unresolved_card_health(
  integer, text, text, integer
) from public, anon;
revoke all on function public.get_ingestion_job_health(
  text, text, timestamptz, integer
) from public, anon;

grant execute on function public.get_data_health_summary() to authenticated;
grant execute on function public.get_data_health_region_coverage(integer)
to authenticated;
grant execute on function public.get_commander_analytics_readiness(
  integer, text, boolean, text, text, date, date, integer
) to authenticated;
grant execute on function public.get_unresolved_card_health(
  integer, text, text, integer
) to authenticated;
grant execute on function public.get_ingestion_job_health(
  text, text, timestamptz, integer
) to authenticated;
