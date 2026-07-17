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

Operators may replace the default list with the Edge Function secret
`TOURNAMENT_EXCLUDED_TITLE_KEYWORDS`, using comma-separated phrases. Review a
dry run before changing the production list.

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

Use **Admin Panel → Card-level Decklists** after tournament entries have been
ingested. Start with dry run and a narrow date range. The function prefers
provider structured data, falls back to embedded plaintext, resolves card
identity in Scryfall collection batches, and records partial or unavailable
Decks rather than inventing missing data. External deck-host URLs are retained
but are not fetched unless an explicit safe adapter is implemented.

Dry runs always reevaluate matching source entries, even when **Only missing**
is enabled, because they do not write or replace normalized rows. Real runs
use **Only missing** and **Retry partial** to control reprocessing.

Complete Decks require approximately 100 cards across Commander and mainboard,
one or two Commander cards, and no unresolved card names. Only complete
mainboards contribute to aggregate inclusion. Sideboards, maybeboards,
considering lists, companions, and unknown boards are preserved but excluded
from the default calculation.

## Resumable historical backfills

Migration `202607170005_create_tournament_ingestion_jobs.sql` adds durable job
and batch records. The Admin Panel can split a multi-year TopDeck range into
seven-day requests. Supabase Cron invokes `process-tournament-ingestion`; each
invocation claims and processes only one batch. Completed work remains
checkpointed, interrupted work is recovered after 15 minutes, and a batch is
marked failed after three attempts.

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
