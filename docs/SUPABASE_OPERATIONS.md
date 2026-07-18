# Supabase operations

## Apply and verify the schema

In the Supabase project dashboard, open **SQL Editor**, choose **New query**,
paste `supabase/migrations/202607170001_create_decks_table.sql`, and run it.
Successful execution reports success with no returned rows.

Then open **Table Editor → decks** and verify the table includes `user_id`,
`deck_id`, `deck_data`, and timestamps. In **Database → Tables → decks**, verify
Row Level Security is enabled. Open the table's **Policies** view and confirm
separate authenticated select, insert, update, and delete policies.

To diagnose duplicate logical identities, run:

```sql
select user_id, deck_id, count(*)
from public.decks
group by user_id, deck_id
having count(*) > 1;
```

Review every result manually. Never deduplicate by deck name: different decks
may legitimately share a name. Retain the intended newest row only after
checking its stable `deck_id`, timestamps, and `deck_data`. If an earlier bug
created new Deck IDs, identity-based automatic cleanup is not reliable.

## Authentication URLs

In **Authentication → URL Configuration**, set:

- Site URL: `https://zevl411.github.io/doomsday-mtg/`
- Redirect URL: `https://zevl411.github.io/doomsday-mtg/#/auth/callback`
- Local redirect URL: `http://localhost:5173/doomsday-mtg/#/auth/callback`

Password and email-link authentication use the same callback route. Hash
routing keeps callbacks compatible with GitHub Pages.

## Ownership smoke test

Create two test users. Sign in as the first, create a uniquely named deck, then
sign out and sign in as the second user in a separate private browser session.
The second user must not see or modify the first user's deck. Repeat in the
opposite direction. This manually verifies the RLS ownership boundary.

## Deck comparison RPC

Apply `supabase/migrations/202607180001_add_deck_comparison.sql` and then
`supabase/migrations/202607180002_create_canonical_cards.sql` after the
normalized tournament Deck migrations. The canonical migration backfills
existing rows, adds persistent aliases, and redirects analytics through the
canonical join. Verify the tables, functions, and public execution grants:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('canonical_cards', 'canonical_card_aliases');

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'get_deck_comparison_aggregate',
    'get_similar_tournament_decks'
  );

select has_function_privilege(
  'anon',
  'public.get_deck_comparison_aggregate(text,date,date,integer,integer,text,text,text,boolean,integer)',
  'execute'
), has_function_privilege(
  'anon',
  'public.get_similar_tournament_decks(text,text[],date,date,integer,integer,text,text,text,boolean,integer,integer)',
  'execute'
);
```

Smoke-test a known normalized Commander key with analytical keys:

```sql
select *
from public.get_similar_tournament_decks(
  p_commander_key := 'kinnan, bonder prodigy',
  p_card_keys := array['oracle:00000000-0000-0000-0000-000000000000'],
  p_minimum_complete_decks := 1,
  p_similarity_limit := 5
);
```

Replace the example Oracle UUID with one present in `canonical_cards`. Results
must contain only public tournament metadata,
shared/union counts, and similarity. Confirm the migration contains no read
from `public.decks`, does not alter its RLS policies, and grants no write
permission to tournament tables.
