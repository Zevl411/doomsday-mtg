# DoomsdayMTG

> A modern, data-driven deck builder for Competitive Commander (cEDH).

DoomsdayMTG is an open-source web application focused on helping players build stronger Commander decks through tournament data, card association analysis, and intelligent recommendations.

Unlike traditional deck builders, the long-term goal is to understand **why** cards belong together, not just display decklists.

---

## ✨ Vision

Imagine combining the deck building experience of **Moxfield** with the tournament analytics of **EDHTop16**, then adding recommendation algorithms that understand card relationships learned from thousands of competitive decklists.

The end goal is a tool capable of answering questions like:

- "What cards are core to this commander?"
- "What cards usually appear together?"
- "What cards am I missing?"
- "If I remove this card, what is usually played instead?"
- "What packages are commonly included?"
- "How close is this list to tournament-winning versions?"

---

# Current Features

## Deck Builder

- Search the entire Magic card database
- Add and remove cards
- Select one Commander or a rules-compatible paired Commander combination
- Commander color identity restrictions
- Deck model written in TypeScript
- Responsive Vue 3 interface
- One refresh-safe guest draft and authenticated cloud deck libraries
- Plaintext decklist import and export
- Commander metagame and tournament explorer backed by normalized Supabase data

Guests receive one temporary, refresh-safe browser draft. Authenticated users
receive a multi-deck library whose authoritative records live in Supabase;
authenticated deck data is not mirrored into localStorage. On sign-in, one
meaningful guest draft is automatically saved to the account with its stable
deck ID. The browser copy is removed only after that deck can be read back from
Supabase. Failed cloud writes leave the current in-memory edit available for
retry during the session, but refreshing can lose an authenticated edit that
has not reached Supabase.

Persistence remains behind repository modules, so Vue components and deck
rules do not call localStorage or Supabase directly.

Accounts support password and email-link authentication. A meaningful guest
draft transfers automatically on sign-in; there is no manual library migration
or whole-library local/cloud reconciliation.

### Plaintext decklists

Import accepts card names with an optional positive quantity:

```text
1 Sol Ring
1x Arcane Signet
4 Island
Command Tower
```

Generic plaintext, Moxfield-style, Archidekt, MTG Arena, and Magic Online text
are supported through automatic detection or a manual format choice.
`Commander`, `Command Zone`, `Deck`, `Main`, `Mainboard`, and `Maindeck`
headings are recognized case-insensitively, including decorative forms such as
`~~Commanders~~`, `**Mainboard**`, and `-- Sideboard --`. Arena, Moxfield, and
Archidekt printing annotations such as `(ONE) 196` are removed before lookup.
Single- and double-slash face separators are normalized, so both
`Sink into Stupor / Soporific Springs` and
`Sink into Stupor // Soporific Springs` resolve consistently. Scryfall flavor
names such as `Hope's Aero Magic` are mapped back to their canonical card
(`Cyclonic Rift`) before legality and singleton checks.

The deck stores mainboard, sideboard, maybeboard, and considering cards.
Auxiliary boards are preserved through local storage, editing, import, and
export, but only the mainboard is checked for Commander color identity,
singleton legality, and the 100-card total. Companion, acquireboard, and token
sections are recognized and summarized but remain untracked.

For a headerless Moxfield-style list, commander inference is attempted only
when the list resembles a Commander deck and Scryfall confirms that its first
card is Commander-eligible. Otherwise the current Commander is retained or the
preview asks for a Commander.

Clean imports replace the current deck immediately after processing. Imports
with errors remain open for an explicit proceed-or-cancel decision. Partner
Commanders and file-based import/export are not supported yet.

Future EDHTop16 tournament JSON will use a dedicated structured-data adapter
that normalizes into the same Deck model; EDHTop16 is intentionally not a
plaintext paste format and is not queried by the current importer.

---

# Planned Features

## Smart Recommendations

Instead of simple "people also play..." suggestions, DoomsdayMTG aims to learn deck structure.

Example:

```
Thassa's Oracle
        │
        ├── Demonic Consultation
        ├── Tainted Pact
        ├── Pact of Negation
        ├── Brain Freeze
        └── Underworld Breach
```

Recommendations will eventually be based on:

- tournament frequency
- card pairing statistics
- archetype clustering
- commander similarity
- win rate weighting

---

## Tournament Analytics

Aggregate cEDH tournament data to provide:

- Top performing lists
- Card inclusion percentages
- Average deck composition
- Meta trends
- Tech choices
- Side-by-side deck comparisons

---

## Deck Comparison

Compare your deck against:

- Tournament winners
- Average lists
- Custom decklists

Highlight:

- Missing staples
- Unique choices
- Flex slots
- Statistical outliers

---

## Package Detection

Automatically recognize common packages like:

- Thoracle Combo
- Dockside Loops
- Breach Lines
- Food Chain
- Ad Nauseam
- Hulk Lines
- Stax Packages

Rather than only suggesting individual cards.

---

## Card Association Engine

One of the primary goals of the project.

Build a graph of relationships between cards.

Example:

```
Esper Sentinel
        │
        ├── Rhystic Study
        ├── Smothering Tithe
        ├── Mystic Remora
        └── Deafening Silence
```

These relationships become the basis for intelligent recommendations.

---

# Tech Stack

Frontend

- Vue 3
- TypeScript
- Vite
- Vue Router
- Vuetify
- Pinia
- Vitest
- Vue Test Utils
- Mana font, exposed through local Vue mana-symbol components
- Scryfall API
- GitHub Actions
- GitHub Pages

For module boundaries, state ownership, the import pipeline, persistence
migration, and testing conventions, see
[Architecture](docs/ARCHITECTURE.md).

Available routes:

- `#/` — Home
- `#/decks` — Guest draft or authenticated cloud deck library
- `#/deck-builder` — Deck Builder

Hash-based routing is used so direct links and page refreshes work when the
application is deployed to GitHub Pages.

## Development and deployment

Run the local development server:

```bash
npm run dev
```

Run the focused unit tests:

```bash
npm run test
```

Run tests continuously while developing:

```bash
npm run test:watch
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

### Optional Supabase setup

Copy `.env.example` to `.env.local` and provide the browser-safe project URL
and publishable key:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Apply `supabase/migrations/202607170001_create_decks_table.sql` to create the private
deck table and Row Level Security policies. No service-role key belongs in the
frontend. Without these variables, the app and tests run in guest-only mode.

In Supabase Authentication URL Configuration, add:

- Site URL: `https://zevl411.github.io/doomsday-mtg/`
- Redirect URL: `https://zevl411.github.io/doomsday-mtg/#/auth/callback`
- Local redirect: `http://localhost:5173/doomsday-mtg/#/auth/callback`

For GitHub Pages builds, add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` under **Repository Settings → Secrets and
variables → Actions → Variables**. The CI and deployment workflows pass these
browser-publishable values to Vite without hard-coding them.

Detailed schema, RLS, duplicate-diagnostic, and two-user verification steps are
in [Supabase operations](docs/SUPABASE_OPERATIONS.md).

### Tournament ingestion

Tournament pages read normalized public data from Supabase. EDHTop16 requests
run only inside an administrator-triggered Edge Function; the static Vue
frontend receives neither provider response shapes nor private credentials.
See [Tournament ingestion](docs/TOURNAMENT_INGESTION.md) for migrations, Edge
Function deployment, admin setup, dry runs, attribution, limitations, and
metric definitions.

Cloud records store a complete Deck JSON document for this MVP. This is not
end-to-end encrypted. RLS restricts records to their authenticated owner;
future tournament analytics will use separate normalized data. Account
deletion and sophisticated multi-device conflict resolution remain deferred.

GitHub Pages deployment is configured at
`https://zevl411.github.io/doomsday-mtg/`. Pushes to `main` automatically build
and deploy the application.

GitHub Actions runs tests before building and deploying. The optional GitHub
CLI can be used to inspect those runs; it is not an npm dependency:

```bash
gh run list
gh run watch
gh run view --log-failed
```

Planned Backend

- Node.js
- PostgreSQL
- Python data processing
- Tournament data ingestion

Data Sources

- Scryfall API
- cEDH tournament results
- Public decklists

---

# Roadmap

## Phase 1 — MVP ✅

- [x] Vue project setup
- [x] TypeScript models
- [x] Commander selection
- [x] Card search
- [x] Add/remove cards
- [x] Commander legality filtering
- [ ] Deck statistics
- [x] Import/Export decklists
- [x] Save decks locally
- [x] Authenticated Supabase deck CRUD
- [x] Refresh-safe temporary guest draft
- [x] Idempotent guest-to-cloud transfer
- [x] v0.1 stabilization

### v0.1.0 release readiness

- [x] Automated tests passing
- [x] Production build passing
- [ ] GitHub Pages deployment smoke tested after release
- [ ] Local email-link authentication smoke tested
- [ ] Production email-link authentication smoke tested
- [ ] Guest draft confirmed to transfer exactly once
- [ ] Repeated login confirmed to create no duplicate Decks
- [ ] Two test users confirmed unable to access each other's rows
- [ ] Import and export manually smoke tested
- [ ] All tracked boards manually confirmed after cloud reload
- [ ] Narrow-screen mobile flow manually smoke tested
- [x] README and architecture documentation current
- [x] Known MVP limitations documented

Known deck-builder limitations include no banned-list enforcement, no special
oracle-text quantity exceptions, and no authenticated offline cache. Partner,
named partner pairs, Partner—variants, Backgrounds, and Doctor's companions are
supported. An authenticated edit that has not reached Supabase can be lost by
refreshing before retrying.

---

## Phase 2 — Tournament Explorer 🚧 *(Current)*

- [x] Provider-neutral tournament models
- [x] Normalized tournament and entry tables
- [x] Public read-only tournament RLS
- [x] Admin-protected EDHTop16 ingestion boundary
- [x] Idempotent tournament and entry identities
- [x] Commander metagame aggregation
- [x] Metagame, Commander, and tournament routes
- [x] In-app viewing for linked tournament decklists
- [ ] Validate the current EDHTop16 API contract with production fixtures
- [ ] Deploy and run the first administrator dry run
- [ ] Add TopDeck adapter after credentials and attribution requirements exist

Current data limitations: provider fields may be absent, historical coverage
depends on imported events, draws count in the match-rate denominator, and no
card-level tournament deck contents are ingested.

---

## Phase 3 — Deck Builder Enhancements

- [ ] Mana curve visualization
- [ ] Color pip analysis
- [ ] Tagging system
- [ ] Multiple commanders / Partners
- [ ] Drag & drop sorting
- [ ] Land recommendations

---

## Phase 4 — Data Collection

- [ ] Tournament scraper
- [ ] Deck database
- [ ] Commander archetype detection
- [ ] Card inclusion statistics
- [ ] Historical tournament tracking

---

## Phase 5 — Analytics

- [ ] Deck comparison engine
- [ ] Card association graph
- [ ] Package detection
- [ ] Meta reports
- [ ] Win-rate analysis

---

## Phase 6 — Intelligent Recommendations

The "magic" of DoomsdayMTG.

Generate recommendations using:

- association graphs
- deck similarity
- archetype clustering
- tournament weighting
- statistical confidence

Eventually allowing recommendations that feel more like an experienced cEDH player than a search engine.

---

# Learning Goals

This project is also a personal learning journey.

Areas I'm intentionally learning while building:

- TypeScript
- Vue 3
- Large-scale application architecture
- Data engineering
- Recommendation systems
- Statistical analysis
- Graph algorithms

The codebase prioritizes readability over cleverness, with comments explaining important TypeScript concepts as they're introduced.

---

# Contributing

Contributions, suggestions, and ideas are welcome.

The project is still in its early stages, and the architecture is expected to evolve as new features are added.

---

# Inspiration

- Moxfield
- EDHTop16
- Scryfall
- Archidekt

---

# License

MIT
