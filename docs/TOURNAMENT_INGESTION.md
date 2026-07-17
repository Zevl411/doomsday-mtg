# Tournament ingestion

```text
EDHTop16 → provider adapter → ingest-tournaments Edge Function
         → normalized Supabase tables → Vue repository → metagame views
```

EDHTop16 is the initial provider. Its adapter and DTOs live only in the Edge
Function. The normalized schema and frontend do not depend on provider field
names. `TournamentProvider` is the boundary for a future TopDeck adapter.
TopDeck is not enabled until its API key is configured and its attribution
requirements are implemented.

## Deploy

Install the Supabase CLI, authenticate, and run:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy ingest-tournaments
supabase secrets set EDHTOP16_BASE_URL=https://edhtop16.com
```

Do not commit the access token, service-role key, or provider credentials.
Supabase supplies its URL, anonymous key, and service-role key to deployed Edge
Functions. If TopDeck is added later, configure it server-side:

```bash
supabase secrets set TOPDECK_API_KEY=YOUR_PRIVATE_KEY
```

## Grant an ingestion administrator

Use the Supabase SQL Editor with a reviewed Auth user UUID:

```sql
insert into public.admin_users (user_id)
values ('AUTH_USER_UUID')
on conflict (user_id) do nothing;
```

The hidden `#/admin/ingestion` route checks this membership, and the Edge
Function independently checks it again. Ordinary authenticated users cannot
write tournament tables or invoke ingestion successfully.

Start with a dry run in the admin screen. Dry runs fetch and validate provider
data without database writes. Ingestion is manual; ordinary page visits never
trigger provider requests.

The same protected dry run can be invoked from a terminal with an authenticated
administrator access token:

```bash
curl --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest-tournaments' \
  --header 'Authorization: Bearer ADMIN_USER_ACCESS_TOKEN' \
  --header 'apikey: YOUR_PUBLISHABLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"provider":"edhtop16","minimumPlayers":32,"dryRun":true}'
```

Do not paste an access token into source files or shell history on a shared
machine.

## Metric definitions

- **Meta share:** Commander entries divided by all entries matching the filter.
- **Match win rate:** wins divided by wins + losses + draws.
- **Top-16 finishes:** entries whose final standing is 16 or better by default.
- **Top-cut rate:** top-16 finishes divided by Commander entries.
- **First-place finishes:** entries whose standing is exactly 1.

Missing dates, standings, pilots, and decklist URLs remain nullable. Provider
coverage and reporting quality can vary, so every view displays source and
sample-size context.
