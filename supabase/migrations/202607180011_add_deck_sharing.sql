alter table public.decks
  add column if not exists description text not null default '',
  add column if not exists visibility text not null default 'private',
  add column if not exists creator_username text not null default 'Unknown';

alter table public.decks
  drop constraint if exists decks_description_length_check,
  add constraint decks_description_length_check
    check (char_length(description) <= 500),
  drop constraint if exists decks_visibility_check,
  add constraint decks_visibility_check
    check (visibility in ('private', 'unlisted', 'public'));

create unique index if not exists decks_deck_id_unique_idx
on public.decks(deck_id);

update public.decks deck
set creator_username = coalesce(
  nullif(trim(user_row.raw_user_meta_data->>'username'), ''),
  nullif(trim(user_row.raw_user_meta_data->>'user_name'), ''),
  nullif(trim(user_row.raw_user_meta_data->>'full_name'), ''),
  split_part(user_row.email, '@', 1),
  'Unknown'
)
from auth.users user_row
where user_row.id = deck.user_id
  and deck.creator_username = 'Unknown';

create or replace function public.set_deck_creator_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
    select coalesce(
      nullif(trim(user_row.raw_user_meta_data->>'username'), ''),
      nullif(trim(user_row.raw_user_meta_data->>'user_name'), ''),
      nullif(trim(user_row.raw_user_meta_data->>'full_name'), ''),
      split_part(user_row.email, '@', 1),
      'Unknown'
    )
    into new.creator_username
    from auth.users user_row
    where user_row.id = new.user_id;
  else
    new.creator_username = old.creator_username;
  end if;
  return new;
end;
$$;

drop trigger if exists set_deck_creator_username on public.decks;
create trigger set_deck_creator_username
before insert or update on public.decks
for each row execute function public.set_deck_creator_username();

drop policy if exists "Users can view their own decks" on public.decks;
drop policy if exists "Users can read their own decks" on public.decks;
create policy "Decks are visible according to sharing settings"
on public.decks for select
to anon, authenticated
using (
  visibility in ('public', 'unlisted')
  or user_id = (select auth.uid())
  or exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);

grant select on public.decks to anon, authenticated;
