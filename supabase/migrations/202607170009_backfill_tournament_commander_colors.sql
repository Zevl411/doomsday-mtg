-- Tournament providers often identify Commanders without supplying their
-- color identity. Normalized Commander cards already contain Scryfall's
-- identity, so use them to repair entries ingested before this was persisted.
with resolved_identities as (
  select
    deck.tournament_entry_id,
    array_agg(
      distinct color
      order by color
    ) as color_identity
  from public.tournament_decks deck
  join public.tournament_deck_cards card
    on card.tournament_deck_id = deck.id
  cross join lateral unnest(card.color_identity) as color
  where card.board = 'commander'
  group by deck.tournament_entry_id
)
update public.tournament_entries entry
set
  color_identity = identity.color_identity,
  updated_at = now()
from resolved_identities identity
where entry.id = identity.tournament_entry_id
  and identity.color_identity is not null
  and cardinality(identity.color_identity) > 0
  and entry.color_identity is distinct from identity.color_identity;
