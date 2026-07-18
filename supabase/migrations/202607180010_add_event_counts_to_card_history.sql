-- Event counts help distinguish broad tournament adoption from several Decks
-- appearing at the same event. PostgreSQL requires dropping the old signature
-- before adding a column to a function's table return type.
drop function if exists public.get_commander_card_inclusion_over_time(
  text, uuid, text, text, timestamptz, timestamptz, integer,
  text, text, text, boolean, integer
);

create function public.get_commander_card_inclusion_over_time(
  target_commander_key text,
  target_oracle_id uuid default null,
  target_normalized_card_key text default null,
  time_bucket text default 'week',
  start_date timestamptz default null,
  end_date timestamptz default null,
  minimum_tournament_size integer default 0,
  country_filter text default null,
  state_filter text default null,
  region_filter text default null,
  online_filter boolean default null,
  maximum_standing integer default null
)
returns table (
  period_start date,
  deck_count bigint,
  total_eligible_decks bigint,
  event_count bigint,
  inclusion_rate numeric
)
language sql
stable
set search_path = ''
as $$
  with eligible as (
    select
      deck.id,
      tournament.id as event_id,
      date_trunc(
        case time_bucket
          when 'day' then 'day'
          when 'month' then 'month'
          when 'year' then 'year'
          else 'week'
        end,
        tournament.event_date
      )::date as period_start
    from public.tournament_decks deck
    join public.tournament_entries entry
      on entry.id = deck.tournament_entry_id
    join public.tournaments tournament
      on tournament.id = entry.tournament_id
    where deck.commander_key = target_commander_key
      and deck.parsing_status = 'complete'
      and tournament.event_date is not null
      and (start_date is null or tournament.event_date >= start_date)
      and (
        end_date is null
        or tournament.event_date < end_date + interval '1 day'
      )
      and coalesce(tournament.player_count, 0) >= minimum_tournament_size
      and (country_filter is null or tournament.country_code = country_filter)
      and (state_filter is null or tournament.state_region = state_filter)
      and (region_filter is null or tournament.region_key = region_filter)
      and (
        online_filter is null
        or coalesce(tournament.is_online, false) = online_filter
      )
      and (maximum_standing is null or entry.standing <= maximum_standing)
  ),
  period_totals as (
    select
      eligible.period_start,
      count(*)::bigint as total,
      count(distinct eligible.event_id)::bigint as events
    from eligible
    group by eligible.period_start
  ),
  period_cards as (
    select
      eligible.period_start,
      count(distinct card.tournament_deck_id)::bigint as decks
    from eligible
    join public.tournament_deck_card_details card
      on card.tournament_deck_id = eligible.id
    where card.board = 'mainboard'
      and (
        (
          target_oracle_id is not null
          and card.oracle_id = target_oracle_id
        )
        or (
          target_oracle_id is null
          and target_normalized_card_key is not null
          and card.normalized_card_key = target_normalized_card_key
        )
      )
    group by eligible.period_start
  )
  select
    period_totals.period_start,
    coalesce(period_cards.decks, 0)::bigint,
    period_totals.total,
    period_totals.events,
    case
      when period_totals.total = 0 then 0
      else coalesce(period_cards.decks, 0)::numeric / period_totals.total
    end
  from period_totals
  left join period_cards using (period_start)
  order by period_totals.period_start;
$$;

revoke all on function public.get_commander_card_inclusion_over_time(
  text, uuid, text, text, timestamptz, timestamptz, integer,
  text, text, text, boolean, integer
) from public;

grant execute on function public.get_commander_card_inclusion_over_time(
  text, uuid, text, text, timestamptz, timestamptz, integer,
  text, text, text, boolean, integer
) to anon, authenticated;
