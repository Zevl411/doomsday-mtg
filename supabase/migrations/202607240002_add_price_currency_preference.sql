-- TCGplayer currently publishes marketplace prices in USD. Store the choice
-- explicitly so additional native currencies can be introduced without
-- changing the preference contract later.
alter table public.user_preferences
  add column if not exists price_currency text not null default 'USD';

alter table public.user_preferences
  drop constraint if exists user_preferences_price_currency_check,
  add constraint user_preferences_price_currency_check
    check (price_currency in ('USD'));

notify pgrst, 'reload schema';
