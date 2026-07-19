-- New decks are public by default unless their creator explicitly chooses a
-- different visibility. Existing decks and saved user preferences are kept.
alter table public.decks
  alter column visibility set default 'public';

alter table public.user_preferences
  alter column default_deck_visibility set default 'public';

notify pgrst, 'reload schema';
