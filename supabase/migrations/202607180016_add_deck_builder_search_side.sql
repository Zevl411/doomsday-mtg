alter table public.user_preferences
  add column if not exists deck_builder_search_side text not null
    default 'right';

alter table public.user_preferences
  drop constraint if exists user_preferences_deck_builder_search_side_check,
  add constraint user_preferences_deck_builder_search_side_check
    check (deck_builder_search_side in ('left', 'right'));

notify pgrst, 'reload schema';
