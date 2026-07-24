-- A generated palette is stored with its source card so applying a preference
-- never depends on Scryfall being reachable during a later page load.
alter table public.user_preferences
  add column if not exists app_theme jsonb not null
    default '{"mode":"default"}'::jsonb;

alter table public.user_preferences
  drop constraint if exists user_preferences_app_theme_shape_check,
  add constraint user_preferences_app_theme_shape_check
    check (
      jsonb_typeof(app_theme) = 'object'
      and app_theme->>'mode' in ('default', 'card')
    );

notify pgrst, 'reload schema';
