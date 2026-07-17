# DoomsdayMTG Architecture

This document explains how the current MVP is divided, how data moves through
the application, and where future work should live. Keep it updated when a
change moves ownership or introduces a new architectural boundary.

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

## Deck ownership

`src/models/deck.ts` defines the application-owned `Deck` and `DeckCard`
shapes. A Deck contains:

- a stable application ID and created/updated timestamps;
- one optional Commander;
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

The collection endpoint is the primary resolver. Modal double-faced entries use
their front face as the collection identifier. Names the batch cannot resolve
receive a paced exact-name fallback, which covers Scryfall flavor-name variants
without turning every import back into one request per card. Returned canonical,
flavor, printed, and face names all map to the same `ScryfallCard` and stable
oracle identity.

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

EDHTop16 and tournament data do not belong in the plaintext parser. A future
structured adapter should fetch structured data in `src/api`, normalize it in a
dedicated service, and return the same application-owned Deck model.
