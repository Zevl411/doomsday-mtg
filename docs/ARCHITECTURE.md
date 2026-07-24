# DoomsdayMTG Architecture

Public branding is configured through `VITE_APP_NAME` and
`VITE_APP_TAGLINE`. The GitHub Pages base path is configured independently
through `VITE_BASE_PATH`. Stable storage keys, database names, and historical
migration identifiers intentionally do not change when the display name does.

This document explains how the current MVP is divided, how data moves through
the application, and where future work should live. Keep it updated when a
change moves ownership or introduces a new architectural boundary.

## Visual system

The Oracle theme owns brand colors, while `src/plugins/vuetify.ts` owns shared
component density, radius, and elevation defaults. `src/style.css` supplies the
small set of cross-component typography, table, dialog, and spacing refinements
that Vuetify defaults cannot express. Feature components should preserve these
defaults unless card artwork or a specific workflow needs a documented
exception. This keeps visual changes separate from route composition, domain
logic, and interaction behavior.

Vuetify controls use its bundled Material Design SVG icon set rather than an
external icon font. App-specific icons are registered as semantic aliases in
`src/plugins/vuetify.ts`, and icons inherit their control's foreground color.
Themes must provide matching `on-*` colors for filled surfaces so checkboxes,
select indicators, dialog actions, and icon buttons remain visible in both the
Oracle palette and card-art-derived palettes.

The Oracle theme is also the permanent fallback for user-selected app themes.
`src/theme/cardArtTheme.ts` samples Scryfall's art-only card crop in a small
browser canvas, derives a dark palette, and validates the saved palette before
it reaches Vuetify. The generated colors are stored with the source card in
user preferences so restoring a theme does not require a network request.
Semantic error, warning, and success colors remain fixed across generated
themes so their meaning and contrast do not depend on the selected artwork.

Indeterminate loading states use `AppLoadingSkeleton` variants that approximate
the incoming card, list, table, detail, or chart layout. Determinate ingestion
progress remains a progress bar because it communicates measured completion,
and card-association loading intentionally retains its compact progress bar.

## Runtime overview

```text
Vue route-level view
        │
        ├── reusable Vuetify components
        │       ├── emit user intentions
        │       └── read shared Pinia state
        │
        ├── Pinia deck store
        │       ├── owns the current Deck library and active Deck ID
        │       ├── performs mutations
        │       └── saves meaningful mutations
        │
        ├── domain utilities
        │       ├── legality and size validation
        │       ├── card identity
        │       └── decklist parsing/formatting
        │
        └── API layer
                └── Scryfall HTTP requests and rate limiting
```

`App.vue` only provides the shared layout and `RouterView`. Page composition
belongs in `src/views`; reusable interface pieces belong in `src/components`.

Mana and color-identity symbols are local font glyphs from `mana-font`, wrapped
by `ManaSymbol.vue` and `ColorIdentitySymbols.vue`. Feature templates should
use those Vue components instead of remote symbol images or raw font classes.

## Interface terminology

Use these names consistently in issues, comments, and component discussions:

- **Magic card**: an actual Magic: The Gathering card represented by
  `ScryfallCard`.
- **Deck entry**: a Magic card plus its quantity, represented by `DeckCard`.
- **Magic card tile**: a visual Magic card result or image, such as
  `TournamentCardImage`.
- **Deck summary card**: the Vuetify card that represents an entire saved Deck,
  such as `DeckLibraryCard` and the recent-deck cards on the home page.
- **Panel** or **surface**: a generic Vuetify `v-card` used only to group UI.

Avoid the unqualified phrase “deck card”: it can mean either a Magic card
inside a Deck or a Vuetify card representing the Deck itself.

## Deck ownership

`src/models/deck.ts` defines the application-owned `Deck` and `DeckCard`
shapes. A Deck contains:

- a stable application ID and created/updated timestamps;
- one optional Commander;
- optional foil finishes for the Commander and Partner Commander, stored on the
  Deck because those cards are not quantity-bearing board entries;
- `cards`, the mainboard retained under its legacy property name;
- sideboard, maybeboard, and considering boards;
- a user-facing deck name.

Pinia's `useDeckStore` is the single source of truth for the current Deck
collection, active Deck selection, and editor mutations. Components may
read the store and call actions, but they should not introduce a second copy
of deck state. Import previews are temporary and intentionally remain inside
the import component until the user confirms replacement.

Card equality uses `oracle_id` when available so different printings still
represent one game card. The printed `id` is only a fallback/display identity.
The printing picker queries Scryfall's paginated English paper editions and
passes the confirmed record to `replaceCardPrinting`. That store action rejects
a different Oracle identity and changes only the stored card record, preserving
its board and quantity. Printing metadata is optional so older saved Decks
remain valid.
The selected foil treatment belongs to `DeckCard`, not `ScryfallCard`, because
finish is a choice for one Deck entry. Scryfall's printing-level finish data
guards new choices when available; legacy saved cards remain permissive. The
foil overlay is presentation-only and never changes card identity or legality.
Printing-specific TCGplayer market values remain optional metadata on
`ScryfallCard`. `CardPreview` displays regular, foil, and etched USD values
when supplied. Older stored cards are refreshed by printing ID on first
preview. `useCardPricingStore` refreshes a Deck's exact printing IDs in
collection-sized batches and retains one current snapshot per browser session,
so totals do not require a request per card. Pricing never participates in
Oracle identity, legality, or Deck mutations.

All Deck price surfaces use `src/utils/cardPrice.ts`: list rows and optional
grid labels multiply the selected finish by quantity, group headings sum those
entries, and the header sums Commander(s) plus Mainboard. The grid-price toggle
is stored with the Deck panel's other browser-local display controls rather
than synced as an account preference. Missing prices are excluded rather than
treated as zero. Sideboard, Maybeboard, and Considering prices appear in their
own rows and groups but do not inflate the playable Deck total.

## Board rules

Only the mainboard participates in Commander legality and the 100-card count.
It requires a Commander, follows color identity, and applies singleton rules.
Basic lands are the only current quantity exception.

Sideboard, maybeboard, and considering are planning boards. They preserve
quantities and stable identity but do not affect deck-size or color-identity
validation. Companion, tokens, and acquireboard are recognized during import
but are not stored yet.

## Search request lifecycle

`CardSearch.vue` owns only local search state:

1. Vue watches the query and optional parent filter.
2. A 250 ms debounce avoids a request for every keystroke.
3. Changing the query aborts any request that is no longer relevant.
4. Unmounting clears the timer and aborts active work.
5. The component emits selected and hovered cards; it never mutates a Deck.

`src/api/scryfall.ts` owns URLs, request headers, response handling, batching,
rate pacing, and network error messages. Regular search uses Scryfall search.
Deck import uses the collection endpoint in groups of at most 75 normalized
names to avoid per-card traffic and HTTP 429 responses.
Printing lookup uses `unique=prints`, follows validated Scryfall pagination,
and progressively renders large result sets in the picker.
Exact-printing lookup supplies current preview pricing for legacy Deck records.
Price refresh failures stay silent because marketplace data is supplementary
and must not obscure otherwise usable card details.

The collection endpoint is the primary resolver. Modal double-faced entries use
their front face as the collection identifier. Names the batch cannot resolve
receive a paced exact-name fallback, which covers Scryfall flavor-name variants
without turning every import back into one request per card. Returned canonical,
flavor, printed, and face names all map to the same `ScryfallCard` and stable
oracle identity.

Tournament normalization persists that mapping across Edge Function
invocations. `canonical_cards` stores Scryfall and rules metadata once per
card, while `canonical_card_aliases` maps provider names, flavor names, and
face names to that record. New `tournament_deck_cards` rows store only the
canonical reference, board, and quantity. This avoids repeating card metadata
and prevents later batches from resolving common cards through Scryfall again.

## Import pipeline

```text
raw pasted text
    ↓
format detection / manual format override
    ↓
heading and card-line normalization
    ↓
normalized ParsedDecklist (no network access)
    ↓
batched Scryfall resolution
    ↓
Commander selection or cautious inference
    ↓
mainboard legality and auxiliary-board assembly
    ↓
PreparedDeckImport preview
    ↓
confirmed Pinia replacement and repository save
```

The parser never calls Scryfall. It recognizes known and decorative headings,
tracks the active board across blank lines, strips only unambiguous printing
metadata, and records malformed input with original line numbers.

Commander inference is deliberately conservative. A first card is considered
only when the text resembles a Commander list, its quantity is one, it resolves
successfully, and Scryfall confirms `is:commander legal:commander`.

Clean imports replace the Deck immediately and close the dialog. Imports with
errors remain previews until the user proceeds or cancels. Network failure
never partially mutates the active Deck.

## Persistence

The Pinia store depends on repository modules rather than calling localStorage
or Supabase from components and domain rules.

Guest mode intentionally stores exactly one refresh-safe temporary draft under
`doomsday-mtg-guest-draft`. `guestDraftRepository` delegates validation and
serialization to `src/utils/deckStorage.ts`, the only module that accesses
localStorage. A one-time compatibility path retains the active deck from the
former guest library and removes the old key only after the new draft saves.

Authenticated mode treats Supabase as authoritative. Pinia holds the working
library in memory, `supabaseDeckRepository` performs CRUD, and no per-user
localStorage cache is created. The `deck-sync` store loads the cloud library,
performs optimistic writes, reports failures without rolling back session
state, and provides retry behavior. A refresh can lose an authenticated edit
that has not reached Supabase; this is the intentional offline limitation of
the simplified MVP.

When a user signs in with a meaningful guest draft, the sync store upserts that
single deck using its existing stable ID. It reloads the cloud records and only
clears the guest draft after confirming the ID is retrievable. Empty drafts are
not uploaded. A failed transfer leaves the guest data intact and exposes a
retryable status. Logging out clears cloud state from Pinia and returns to the
guest repository.

The cloud `decks` table stores one complete Deck JSON value per record for this
MVP. Row Level Security compares `auth.uid()` with `user_id` for every select,
insert, update, and delete. Complete JSON preserves all tracked boards without
prematurely coupling deck-builder storage to future normalized tournament
analytics.

The current MVP deliberately has no local/cloud reconciliation or automatic
conflict-copy algorithm. Supabase's unique `(user_id, deck_id)` constraint
makes saves idempotent, while Row Level Security is the ownership boundary.

The earlier duplicate-deck bug came from treating both restored local libraries
and cloud libraries as synchronization inputs during repeated login
initialization. Reconciliation could manufacture conflict copies while
`getSession` and auth events repeated the work. The v0.1 flow has one guarded
auth-dependent initializer, no authenticated browser cache, and stable-ID
upserts for the single permitted guest transfer.

Temporary UI state—search text, previews, dialogs, and import issues—is never
stored with the Deck.

## Routing and deployment

Vue Router uses hash history because GitHub Pages cannot provide server-side
fallback routing. Route-level views are lazy-loaded. Vite's base path is
`/doomsday-mtg/`, so static document links must use `%BASE_URL%` or imported
assets instead of root-relative URLs.

Both CI and the Pages deployment workflow run tests before the production
build. There are intentionally no local Git hooks.

## Descriptive Deck comparison

`#/decks/:deckId/compare` compares one repository-owned personal Deck with
public normalized tournament data. The personal Deck remains in Pinia and its
guest or authenticated repository; comparison sends Supabase only the
Commander key, filters, and deduplicated mainboard analytical card keys. No
public comparison function reads `public.decks`, user IDs, or private provider
payloads.

`src/services/deckComparison.ts` owns comparison rules. Card identity is Oracle
ID first and normalized canonical name second. Only the user and tournament
mainboards participate; Commanders and auxiliary boards are excluded. The
service combines validated Commander-inclusion rows with user quantities and
assigns descriptive frequency categories without recommending additions or
cuts.

Aggregate overlap is:

```text
shared cards appearing in at least 20% of eligible Decks
────────────────────────────────────────────────────────
all cards appearing in at least 20% of eligible Decks
```

Individual tournament similarity is calculated in PostgreSQL using Jaccard
similarity over unique mainboard identities:

```text
intersection size / union size
```

Only complete normalized Decks for the same Commander enter the sample. SQL
applies date, placement, event-size, region, and online filters and returns at
most 20 deterministic results. Sample status is `sufficient` at 20 or more
complete Decks, `limited` at 5–19, `insufficient` at 1–4, and `unavailable` at
zero. The interface always identifies tournament frequency as descriptive,
not evidence of card quality or causal performance.

## Testing standard

Tests should focus on observable behavior and architectural boundaries:

- parser tests never perform network calls;
- service tests mock every Scryfall function;
- store tests verify both mutation and persistence;
- component tests verify emitted intentions and visible state;
- routing tests verify named paths and the fallback route.

Run:

```bash
npm run test
npm run build
```

## Future data sources

Tournament data follows a server-side provider boundary:

```text
TopDeck (preferred) / EDHTop16 (secondary)
    ↓
provider-neutral Edge Function adapter
    ↓
normalized Supabase tournaments and entries
    ↓
server-side Commander aggregation RPC
    ↓
typed Vue tournament repository
    ↓
route-level metagame and tournament views
```

Provider credentials and raw response parsing never enter the GitHub Pages
bundle. The normalized tournament model is separate from user-owned Decks.
The `ingest-tournament-decks` boundary converts provider structured lists or
embedded plaintext into board-aware `tournament_decks` and
`tournament_deck_cards` rows. Card identity prefers Scryfall Oracle IDs, with
a normalized-name fallback retained for unresolved diagnostics.

The public browser can read normalized Deck snapshots and the aggregate
inclusion RPC but cannot write tournament data. Only complete mainboards enter
inclusion denominators. The Commander card page presents descriptive
frequency, sample size, quantities, and finish subsets; it deliberately does
not generate recommendations. Provider-specific rows remain separate; strong
shared IDs are recorded as source links, while moderate possible matches are
diagnostics only.
Location normalization is a pure server-side boundary and region keys remain
granular so regional taxonomy can be changed later.
Administrative ingestion is authorized by `admin_users` in both the UI and
Edge Function, while RLS gives browser clients read-only tournament access.

## Production Data Health

The administrator-only `#/admin/data-health` view uses one typed flow:

```text
normalized tournament tables
    ↓
bounded, security-definer health RPCs
    ↓
runtime response parsers and pure consistency checks
    ↓
Vuetify operational dashboard
```

The route guard checks `admin_users`, and every health RPC repeats that check
inside PostgreSQL. RPCs return aggregates and bounded diagnostics only. They
never read private `decks`, raw provider payloads, user identities, or
provider credentials.

Commander readiness uses complete normalized Decks and the comparison
thresholds: unavailable at 0, insufficient at 1–4, limited at 5–19, and
sufficient at 20 or more. Inclusion is available at one complete Deck and
comparison at five. Unresolved names remain visible diagnostics and are never
fuzzy-remapped. Pure checks surface impossible status totals and disagreement
between inclusion, aggregate, similarity, and placement samples.

Paired Commander keys use the shared unordered `a // b` normalization rule.
Tests verify reversed pairs produce the same key, do not collide with either
single Commander, and are used consistently by personal Deck comparison.

## Card association engine

The v0.4 association boundary answers one descriptive question: among complete
normalized tournament Decks for a Commander, how often does card B appear when
card A appears? It does not read personal Decks and does not produce additions,
cuts, packages, or recommendations.

```text
complete tournament_decks for one Commander
    ↓ date / region / event-size / placement filters
distinct Oracle-backed mainboard identities per Deck
    ↓ one selected source card
joint and marginal Deck counts
    ↓
support, confidence, lift, sample size, first/last observation
    ↓ runtime-validated repository response
statistical threshold and descriptive-label service
    ↓
CardAssociationsView
```

Only `parsing_status = 'complete'` enters the denominator. Partial,
unavailable, invalid, and pending Decks are excluded. Cards without a canonical
Oracle identity are excluded rather than merged by provider spelling. A card
appears once per Deck for probability calculations even if malformed provider
data contains duplicate rows or quantities.

The statistics have these meanings:

- **Support** is joint Deck count divided by all eligible Decks.
- **Confidence** is joint Deck count divided by Decks containing the selected
  source card.
- **Lift** is confidence divided by the associated card's baseline inclusion
  rate in the same eligible sample. A lift above 1 is a positive observed
  association, not evidence that either card causes performance.
- **Sample size** is the number of complete Commander Decks eligible under all
  active filters.

The public filtered RPC materializes the eligible Deck and card sets once, then
joins candidate cards only to Decks containing the selected source card. This
avoids rebuilding every possible pair for an interactive request. A separate
administrator/service-role refresh function can persist all-time Commander
baselines in `commander_card_associations`. Those rows reference
`canonical_cards`; card names are never duplicated in the association table.
Partial covering indexes keep both paths on complete Decks and normalized
mainboards.

Minimum sample, occurrence, confidence, and lift thresholds protect tiny or
weak samples. PostgreSQL applies the requested thresholds before returning
rows, and `cardAssociationService` repeats the significance boundary before
calculating normalized scores and descriptive strength labels. This defense in
depth prevents a permissive caller or stale baseline from presenting a tiny
sample as meaningful.

Cluster groundwork returns unnamed, overlapping groups of highly connected
Oracle identities from persisted baselines. It intentionally does not assign
package names, archetypes, or suggestion meaning. Future association-based
card-suggestion work can consume the validated statistics and cluster IDs
without changing the database identity or filtering contracts.

## Association-Based Card Suggestions

v0.5 Phase 1 adds a consumer of the v0.4 statistics; it does not add a competing
statistics model. A personal Deck supplies its normalized Commander key and
deduplicated Oracle-backed mainboard identities. No personal Deck ID, user ID,
private row, description, or complete Deck JSON crosses the Supabase boundary.

```text
personal Deck in Pinia
    ↓ Commander key + unique mainboard Oracle IDs only
one batched suggestion-evidence RPC
    ↓ existing complete-Deck sample and v0.4 formulas
runtime-validated evidence rows
    ↓ pure grouping / threshold / relative ordering service
absent suggested cards with exact supporting evidence
    ↓ optional Scryfall display resolution
DeckRecommendationsPanel in the Deck builder
    ↓ suggested-card details and explicit board choice
Commander event list filtered by selected Oracle identities
```

`get_association_based_card_suggestions` materializes the filtered eligible
Decks and normalized mainboard cards once. It then calculates the same support,
confidence, and lift definitions used by `get_commander_card_associations` for
every requested source Oracle ID. This avoids repeating the complete Commander
sample scan once per personal Deck card. Candidate rows must pass the existing
sample, occurrence, confidence, and lift thresholds, plus a configurable count
of distinct supporting source cards.

The repository validates UUIDs, rates, counts, and count relationships before
returning evidence. `associationSuggestionService` then:

- removes cards already present in the personal Deck;
- deduplicates evidence from the same source Oracle identity;
- requires the configured number of distinct supporting cards;
- groups evidence by suggested Oracle identity;
- creates a normalized ordering score from measurable confidence, lift, joint
  count, and supporting-card evidence within the current response.

That ordering score is not card quality, expected performance, or a Deck score.
The UI describes why a card appears only through measured observations, such
as “Among 57 eligible tournament Decks containing Card X, 42 also contained
this card.” It does not infer strategy, Deck needs, rules-text interactions,
additions, removals, or performance effects. Scryfall resolution adds optional
display data only; failed image resolution never removes statistical evidence.

The Deck builder embeds the strongest qualifying results in
`DeckRecommendationsPanel`; there is no separate suggestion route. Deck
Statistics is currently rendered below the board workspace so recommendations
can occupy its previous summary position. The persisted Statistics-placement
preference remains in the data model for future layouts, but is intentionally
not connected to this temporary placement.

Selecting a recommendation opens its exact source-card evidence. Adding it
requires an explicit board choice and uses the existing Deck mutation path.
The Commander detail route can also filter event Decks by up to five selected
cards. `get_commander_deck_events_by_cards` matches all requested canonical
Oracle identities within one complete normalized mainboard; it never admits
partial or unavailable Decks.

Paired Commanders reuse `normalizeCommanderIdentity`, so reversed partner order
continues to share one Commander-scoped tournament sample. Guest and
authenticated Decks both use the same Pinia-owned route flow and their existing
persistence repositories remain unchanged.
