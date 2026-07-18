create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_deck_display text not null default 'grid'
    check (default_deck_display in ('grid', 'list')),
  default_primary_grouping text not null default 'type'
    check (default_primary_grouping in ('name', 'mana', 'type', 'color')),
  default_secondary_grouping text not null default 'name'
    check (default_secondary_grouping in ('none', 'name', 'mana', 'type', 'color')),
  default_deck_visibility text not null default 'private'
    check (default_deck_visibility in ('private', 'unlisted', 'public')),
  default_commander_color_filter boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
create policy "Users manage their own preferences"
on public.user_preferences for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.user_preferences to authenticated;
