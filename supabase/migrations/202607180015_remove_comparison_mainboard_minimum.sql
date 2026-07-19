-- Comparison samples may be useful even when a provider only supplied part of
-- a tournament decklist. Keep parsing status as the quality boundary without
-- requiring an arbitrary number of normalized mainboard cards.
create or replace view public.tournament_decks_for_comparison
with (security_invoker = true) as
select deck.*
from public.tournament_decks deck
where deck.parsing_status in ('complete', 'partial');

grant select on public.tournament_decks_for_comparison
to anon, authenticated;

notify pgrst, 'reload schema';
