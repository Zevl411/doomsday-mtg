alter table public.user_preferences
  add column if not exists deck_statistics_position text not null
    default 'above';

alter table public.user_preferences
  drop constraint if exists user_preferences_deck_statistics_position_check,
  add constraint user_preferences_deck_statistics_position_check
    check (deck_statistics_position in ('above', 'below'));

notify pgrst, 'reload schema';
