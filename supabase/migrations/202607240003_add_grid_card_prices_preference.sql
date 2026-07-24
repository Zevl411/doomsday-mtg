-- List rows always show available prices. This preference controls the extra
-- price labels under image-heavy Deck grid cards.
alter table public.user_preferences
  add column if not exists show_grid_card_prices boolean not null default false;

notify pgrst, 'reload schema';
