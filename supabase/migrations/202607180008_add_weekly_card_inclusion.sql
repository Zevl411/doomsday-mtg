-- Weekly inclusion history powers a bounded, on-demand chart without sending
-- individual tournament Deck rows to the browser.
create or replace function public.get_commander_card_inclusion_by_week(
  target_commander_key text,
  target_oracle_id uuid default null,
  target_normalized_card_key text default null,
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
  week_start date,
  deck_count bigint,
  total_eligible_decks bigint,
  inclusion_rate numeric
)
language sql
stable
set search_path = ''
as $$
  with eligible as (
    select
      deck.id,
      date_trunc('week', tournament.event_date)::date as week_start
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
  weekly_totals as (
    select eligible.week_start, count(*)::bigint as total
    from eligible
    group by eligible.week_start
  ),
  weekly_cards as (
    select
      eligible.week_start,
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
    group by eligible.week_start
  )
  select
    weekly_totals.week_start,
    coalesce(weekly_cards.decks, 0)::bigint,
    weekly_totals.total,
    case
      when weekly_totals.total = 0 then 0
      else coalesce(weekly_cards.decks, 0)::numeric / weekly_totals.total
    end
  from weekly_totals
  left join weekly_cards using (week_start)
  order by weekly_totals.week_start;
$$;

revoke all on function public.get_commander_card_inclusion_by_week(
  text, uuid, text, timestamptz, timestamptz, integer,
  text, text, text, boolean, integer
) from public;

grant execute on function public.get_commander_card_inclusion_by_week(
  text, uuid, text, timestamptz, timestamptz, integer,
  text, text, text, boolean, integer
) to anon, authenticated;
