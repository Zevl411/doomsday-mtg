# Tournament ingestion

```text
TopDeck / EDHTop16 → provider adapter → ingest-tournaments Edge Function
                   → normalized Supabase tables → Vue repository → views
```

TopDeck is the preferred direct provider. EDHTop16 remains a secondary source
for historical and curated coverage. Both adapters and their raw DTOs live
only in the Edge Function; Vue reads the same normalized Supabase tables.
TopDeck uses the exact game `Magic: The Gathering` and format `EDH`. Its
credential is never a `VITE_` variable.

## Deploy

Install the Supabase CLI, authenticate, and run:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set TOPDECK_API_KEY=YOUR_PRIVATE_TOPDECK_KEY
npx supabase secrets set EDHTOP16_BASE_URL=https://edhtop16.com
npx supabase functions deploy ingest-tournaments
```

Obtain a key from TopDeck, then store it under **Supabase Dashboard → Edge
Functions → Secrets** or with the command above. The optional
`TOPDECK_API_BASE_URL=https://topdeck.gg/api` secret is useful only for
controlled endpoint changes. Never put provider credentials in GitHub Pages
variables, source files, logs, fixtures, or ingestion responses.

## Grant an ingestion administrator

Use the Supabase SQL Editor with a reviewed Auth user UUID:

```sql
insert into public.admin_users (user_id)
values ('AUTH_USER_UUID')
on conflict (user_id) do nothing;
```

The `#/admin/ingestion` route checks this membership, and the Edge Function
independently checks it again. Ordinary authenticated users cannot write
tournament tables or successfully invoke ingestion.

Start with a dry run in the admin screen. Then ingest a small date range before
requesting larger ranges. Dry runs fetch and validate without database writes.
Ordinary page visits never trigger provider requests.

```bash
curl --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest-tournaments' \
  --header 'Authorization: Bearer ADMIN_USER_ACCESS_TOKEN' \
  --header 'apikey: YOUR_PUBLISHABLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"provider":"topdeck","minimumPlayers":32,"dryRun":true}'
```

Do not paste an access token into source files or shell history on a shared
machine.

## Location, linking, and coverage

Apply `202607170003_add_tournament_locations.sql` before deploying the updated
function. The admin dashboard reports provider coverage, known locations,
commander extraction failures, structured decklists, source links, and
possible matches.

Location describes the event, never a player's residence. Exact coordinates
may be retained for future analysis but are not displayed publicly. Region
keys such as `country:US/state:FL` are deliberately granular and reprocessable.
Missing location remains `unknown`; no geocoding or invented coordinates occur.

Provider-specific event rows are retained. Identical explicit upstream IDs can
create source links. Similar name/date/size combinations are diagnostic
possible matches only and are never auto-merged. TopDeck is preferred for
direct standings, location, and structured decks; EDHTop16 remains useful for
curated Commander identity and historical gaps. Lower-confidence nulls must
not overwrite higher-confidence fields.

TopDeck requests use bounded retries and honor `Retry-After`. Rounds are off by
default. Location enrichment runs only when requested and bulk data is missing
location.

TopDeck exposes Commander events as `EDH` but does not provide a competitive
or cEDH tag. Ingestion therefore keeps neutral titles and excludes only
explicit casual signals such as `budget`, `casual`, `precon`, `beginner`,
`learn to play`, and `low power`. Dry runs report matching titles. Real runs
also purge a previously stored matching provider event; cascading foreign keys
remove its entries and normalized Decks. This behavior can be disabled per
manual run or historical job.

Built-in signals cover common English, Spanish, Portuguese, French, German,
Italian, Russian, simplified/traditional Chinese, Japanese, and Korean terms.
Commander Bracket 1–4 labels, including compact tags such as `[CoBr4]`, are
also excluded.

Operators may extend the defaults with comma-separated Edge Function secrets:

- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS` for general additions
- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_EN`
- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_ES`
- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_PT`
- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_FR`
- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_DE`
- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_IT`
- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_RU`
- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_ZH`
- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_JA`
- `TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_KO`

Values are additive: custom configuration never removes the built-in safety
list. For example:

```bash
npx supabase secrets set \
  TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_ES="liga social,sin combos" \
  TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_RU="регулярная любительская"
```

Review a dry run after adding regional terminology because title language is a
heuristic and broad words can exclude legitimate competitive events.

For data imported before this filter existed, use the Admin Panel's
**Purge casual TopDeck data** job. It defaults to dry-run mode and reports
matching titles and affected entry counts. Disabling dry run performs the
purge; existing foreign-key cascades remove related entries and normalized
Decks.

## Card-level Deck normalization

Migration `202607170006_create_tournament_decks.sql` adds one normalized Deck
snapshot per tournament entry and normalized card rows separated by board.
After applying it, deploy the dedicated administrator-only function:

```bash
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy ingest-tournament-decks
```

Queued ingestion jobs automatically continue from tournament metadata into
card-level Deck normalization. Each cron invocation handles one bounded stage,
and incomplete Deck work returns to the queue for the next invocation. The
ordinary Admin Panel tournament-ingestion action also creates a Deck-only
background job after a successful dated import. The
manual **Admin Panel → Card-level Decklists** tool remains available for dry
runs, targeted repairs, and data imported outside the durable job workflow.
The normalizer prefers provider structured data, falls back to embedded
plaintext, checks persistent canonical aliases, and sends only previously
unseen names to Scryfall collection batches. Canonical card facts are stored
once; tournament Deck rows retain only the card reference, board, and quantity.
Tournament ingestion stores normalized event metadata without retaining the
large raw event response.
After a complete snapshot is committed, its redundant provider Deck payload is
released. Partial and unavailable Decks retain their payload for repair.
External deck-host URLs are retained but are not fetched unless an explicit
safe adapter is implemented.

Before Scryfall normalization begins, entries explicitly marked `missing` or
`url` are classified as unavailable with one database statement for the whole
tournament window. They do not occupy the 25-entry Edge Function batch used
for resolvable Decks. Dry runs remain read-only and evaluate those entries
through the ordinary parser path.

This normalization job is not required to display tournament decklists.
Tournament detail accordions parse one stored provider entry on demand and
resolve its display images in a bounded Scryfall batch. Persistent card-level
normalization is reserved for aggregate inclusion analytics and other queries
that need stable card identities across many Decks.

Dry runs always reevaluate matching source entries, even when **Only missing**
is enabled, because they do not write or replace normalized rows. Real runs
use **Only missing** and **Retry partial** to control reprocessing.

Complete Decks require approximately 100 cards across Commander and mainboard,
one or two Commander cards, and no unresolved card names. Only complete
mainboards contribute to aggregate inclusion. Sideboards, maybeboards,
considering lists, companions, and unknown boards are preserved but excluded
from the default calculation.

## Resumable historical backfills

Migrations `202607170005_create_tournament_ingestion_jobs.sql` and
`202607170010_connect_tournament_deck_ingestion.sql` add durable two-stage job
and batch records. The Admin Panel can split a multi-year TopDeck range into
seven-day requests. Supabase Cron invokes `process-tournament-ingestion`; each
invocation performs either tournament metadata ingestion or one bounded
card-level normalization pass. Completed work remains checkpointed,
interrupted work is recovered after 15 minutes, and a stage is retried after
failures without repeating successful metadata work.

Generate one private internal secret:

```bash
openssl rand -hex 32
npx supabase secrets set INGESTION_WORKER_SECRET=THE_GENERATED_VALUE
```

Deploy both functions:

```bash
npx supabase functions deploy ingest-tournaments
npx supabase functions deploy process-tournament-ingestion --no-verify-jwt
```

The worker is deployed without gateway JWT verification because Cron is not an
application user. It performs its own `x-ingestion-worker-secret` check before
claiming work. Store the same value in Supabase Vault under
`ingestion_worker_secret`; never put it in a migration or browser variable.

After enabling Cron and `pg_net` in **Dashboard → Integrations**, schedule:

```sql
select cron.schedule(
  'process-tournament-ingestion',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-tournament-ingestion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingestion-worker-secret',
      (select decrypted_secret from vault.decrypted_secrets
       where name = 'ingestion_worker_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Initial historical jobs should use seven-day batches, zero minimum players,
rounds disabled, and location enrichment disabled. Those enrichments can be
run separately after the base standings import.

TopDeck-sourced views visibly link to [TopDeck.gg](https://topdeck.gg);
EDHTop16 attribution remains visible for its records.

## Metric definitions

- **Meta share:** Commander entries divided by all matching entries.
- **Match win rate:** wins divided by wins + losses + draws.
- **Top-16 finishes:** entries whose final standing is 16 or better by default.
- **Top-cut rate:** top-16 finishes divided by Commander entries.
- **First-place finishes:** entries whose standing is exactly 1.
- **Card inclusion:** complete matching Decks containing a mainboard card,
  divided by all complete matching Decks.
- **Average quantity:** total copies of a card divided by Decks containing it.

Core/Common/Flexible/Rare labels are display buckets for descriptive
frequency. They are not recommendations or claims about card quality.

Missing dates, standings, pilots, locations, and decklists remain nullable.

## Interpreting Data Health

- `complete`: the normalized Commander and mainboard are analytics-eligible;
- `partial`: useful cards were retained, but unresolved or missing data keeps
  the Deck out of complete-only analytics;
- `unavailable`: the provider supplied no resolvable decklist;
- `invalid`: the supplied list could not form a usable normalized Deck.

Unresolved card names remain in `parsing_issues`, contribute to the bounded
unresolved-card report, and can prevent a Deck from becoming complete. They
are not guessed or fuzzy-remapped. Review frequent names by provider before
adding a deterministic canonical alias.

To resume work, correct the provider or parsing failure and resume the paused
job in the Admin Panel. Pending batches retain their date window, and the
worker claims unfinished work without repeating completed batches. Data Health
job filters expose failed or stale batches and the last successful tournament
and Deck-normalization timestamps.

Weak coverage is visible in provider totals, missing decklist counts, location
coverage, and Commander readiness region counts. Compare TopDeck and EDHTop16
over the same date range before treating a low regional sample as a metagame
conclusion.
