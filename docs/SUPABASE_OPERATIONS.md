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

## Data Health deployment and verification

Apply migrations in timestamp order through
`202607180007_add_data_health_reporting.sql`:

```bash
npx supabase db push --dry-run
npx supabase db push
```

Verify the functions and grants:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'get_data_health_summary',
    'get_data_health_region_coverage',
    'get_commander_analytics_readiness',
    'get_unresolved_card_health',
    'get_ingestion_job_health'
  );

select
  has_function_privilege('anon', 'public.get_data_health_summary()', 'execute')
    as anon_can_execute,
  has_function_privilege(
    'authenticated',
    'public.get_data_health_summary()',
    'execute'
  ) as authenticated_can_execute;
```

`anon_can_execute` must be false. Authenticated execution is still rejected
unless `auth.uid()` belongs to `admin_users`.

Verify the report indexes:

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'tournament_entries_commander_tournament_idx',
    'tournament_decks_status_commander_idx',
    'tournament_ingestion_jobs_status_updated_idx'
  );
```

While authenticated as an administrator, smoke-test bounded results:

```sql
select * from public.get_data_health_summary();
select * from public.get_data_health_region_coverage(p_limit := 10);
select * from public.get_commander_analytics_readiness(p_limit := 5);
select * from public.get_unresolved_card_health(p_limit := 5);
select * from public.get_ingestion_job_health(p_limit := 5);
```

Open `#/admin/data-health`, compare summary totals to the table editor, inspect
unresolved names and paired Commander rows, then run the read-only smoke test
for a Commander with at least five complete Decks. Inclusion and aggregate
sample counts should agree; similarity results must not exceed that sample.

Before release, use `EXPLAIN (ANALYZE, BUFFERS)` on representative readiness
and unresolved-card calls, confirm no unexpected production-scale sequential
scan, confirm a non-admin receives SQLSTATE 42501, and inspect returned columns
for absence of private Deck data and provider payloads. This flow does not
write data or call external APIs.

## Card association deployment and verification

Apply `202607180019_add_card_association_engine.sql` after canonical card and
normalized tournament Deck migrations. It creates the reusable baseline table,
filtered association RPC, administrator refresh RPC, unnamed cluster RPC, and
partial covering indexes.

Verify objects and access:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'commander_card_associations';

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'get_commander_card_associations',
    'refresh_commander_card_associations',
    'get_commander_card_association_clusters'
  );

select has_function_privilege(
  'anon',
  'public.get_commander_card_associations(text,uuid,date,date,text,integer,integer,integer,integer,numeric,numeric,integer)',
  'execute'
);
```

The privilege query must be true. Browser roles may read observed statistics,
but cannot write the baseline table or call its refresh function.
Administrators and the service role may refresh one Commander baseline:

```sql
select public.refresh_commander_card_associations(
  p_commander_key := 'kinnan, bonder prodigy',
  p_minimum_sample_size := 20,
  p_minimum_occurrence_count := 3
);
```

Smoke-test a known Oracle ID:

```sql
select *
from public.get_commander_card_associations(
  p_commander_key := 'kinnan, bonder prodigy',
  p_source_oracle_id := '00000000-0000-0000-0000-000000000000',
  p_region_key := null,
  p_minimum_sample_size := 20,
  p_minimum_occurrence_count := 3,
  p_limit := 20
);
```

Replace the UUID with an Oracle ID present in `canonical_cards`. Confirm
`support = deck_count / sample_size`, confidence uses Decks containing the
source card, and lift divides confidence by the associated card's baseline
inclusion in the identical sample. Results must exclude partial and unavailable
Decks.

Run the database contract test against an applied development database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/tests/card_associations.sql
```

Before production release, run `EXPLAIN (ANALYZE, BUFFERS)` for a high-volume
Commander with and without date and region filters. The plan should use
`tournament_decks_complete_association_idx` and
`tournament_cards_mainboard_association_idx`; interactive analysis should not
cross-join every card pair. Refresh persisted baselines separately from browser
traffic. Never present support, confidence, lift, or connected groups as proof
of causation or as recommendations.

## Association-based card suggestion deployment

Apply `202607190001_add_association_based_suggestions.sql` after the v0.4 card
association migration. It adds one read-only batched RPC and no new writable
browser table:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'get_association_based_card_suggestions';

select has_function_privilege(
  'anon',
  'public.get_association_based_card_suggestions(text,uuid[],date,date,text,integer,integer,integer,integer,numeric,numeric,integer,integer)',
  'execute'
);
```

The privilege query must be true. Smoke-test using Oracle IDs from one personal
Deck without sending its Deck ID or JSON:

```sql
select *
from public.get_association_based_card_suggestions(
  p_commander_key := 'kinnan, bonder prodigy',
  p_source_oracle_ids := array[
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid
  ],
  p_minimum_sample_size := 20,
  p_minimum_occurrence_count := 3,
  p_minimum_confidence := 0.05,
  p_minimum_lift := 1,
  p_minimum_supporting_cards := 2,
  p_limit := 30
);
```

Replace both UUIDs with canonical Oracle IDs in the selected Deck. Verify:

- every source identity belongs to the supplied array;
- no suggested identity belongs to that array;
- every suggested identity has the configured number of distinct sources;
- `joint_deck_count <= source_deck_count <= sample_size`;
- support, confidence, and lift match the v0.4 formulas;
- only complete normalized tournament mainboards enter the sample.

Run the database contract test:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/tests/association_suggestions.sql
```

Use `EXPLAIN (ANALYZE, BUFFERS)` with a representative 100-card source array.
The eligible and card CTEs should each be materialized once and use the v0.4
partial covering indexes. Returned rows are bounded by suggested candidates,
not by the raw pair count. The UI must present this output only as observed
tournament association evidence.

## Commander event card-filter deployment

Apply `202607190002_add_commander_deck_card_filter.sql` after the association
suggestion migration. The read-only
`get_commander_deck_events_by_cards(text,uuid[],integer)` RPC accepts at most
five Oracle identities from the UI and returns bounded event Deck rows that
contain every requested identity.

Verify the RPC with canonical Oracle IDs from a known complete Deck:

```sql
select *
from public.get_commander_deck_events_by_cards(
  p_commander_key := 'kinnan, bonder prodigy',
  p_oracle_ids := array[
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid
  ],
  p_limit := 100
);
```

Confirm every returned row uses `parsing_status = 'complete'`, the matched
identities occur in the same normalized mainboard, and the plan uses the
complete-Deck and mainboard association indexes. Empty identity arrays must
return no rows.
