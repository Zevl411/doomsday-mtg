-- Tournament list filtering needs a reliable aggregate, not a stored flag that
-- ingestion code could forget to update. This view always derives both counts
-- from the current tournament_entries rows.
create or replace view public.tournament_summaries
with (security_invoker = true) as
select
  tournament.*,
  coalesce(entry_totals.entry_count, 0)::bigint as entry_count,
  coalesce(entry_totals.registered_commander_count, 0)::bigint
    as registered_commander_count
from public.tournaments tournament
left join lateral (
  select
    count(*) as entry_count,
    count(*) filter (
      where trim(entry.commander_name) <> ''
        and lower(trim(entry.commander_name)) <> 'unknown commander'
        and trim(entry.commander_key) <> ''
        and lower(trim(entry.commander_key)) <> 'unknown-commander'
    ) as registered_commander_count
  from public.tournament_entries entry
  where entry.tournament_id = tournament.id
) entry_totals on true;

grant select on public.tournament_summaries to anon, authenticated;
