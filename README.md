# DoomsdayMTG

> A data-driven deck builder and tournament analytics platform for Competitive
> Commander.

## 🚀 Live Demo

Try the latest public build:

**[Open DoomsdayMTG](https://zevl411.github.io/doomsday-mtg/)**

The public application is automatically deployed from the `main` branch after
its tests, TypeScript checks, and production build pass in GitHub Actions.

## Current Status

DoomsdayMTG is an open-source Competitive Commander platform that combines a
modern deck builder with tournament analytics, regional metagame exploration,
and card-level statistics.

The project has completed its core deck-building functionality and now includes
private, unlisted, and public deck sharing; customizable deck-builder layouts;
tournament ingestion from TopDeck and EDHTop16; processed tournament
decklists; regional tracking; Commander card analytics; printing-specific
pricing; and evidence-backed card suggestions.

Current focus: hardening tournament data quality and extending the existing
unnamed association clusters toward package-level analysis.

## Features

### Deck Builder

- Search the complete Magic card database through Scryfall
- Select individual or rules-compatible paired Commanders
- Validate Commander color identity and deck size
- Enforce singleton rules with basic-land quantity exceptions
- Maintain multiple authenticated decks or one browser-local guest draft
- Organize Mainboard, Sideboard, and Maybeboard cards in grid or list views
- Group and order cards by name, mana value, card type, or color
- Choose specific English paper printings and foil treatments for Deck cards,
  Commanders, and Partner Commanders
- View printing- and finish-specific TCGplayer prices in card previews
- See Commander-plus-Mainboard Deck totals, always-visible list prices, and
  optional card and group prices in Deck grid views
- Inspect deck statistics, card-type counts, and an interactive mana curve
- Configure deck visibility as private, unlisted, or public
- Add deck descriptions and attribution to the deck creator
- Copy, rename, delete, import, and export Decks
- Select multiple Decks for bulk deletion or visibility changes
- Customize default display, grouping, visibility, and Deck-builder search
  placement through user preferences
- Persist independent board layouts, sorting, and grid-card sizes
- Keep the Oracle default theme or derive a persistent app palette from any
  distinct card artwork
- Keep card-price currency explicit in user preferences and toggle Deck-grid
  prices directly from the Deck panel; TCGplayer pricing is currently
  available in USD
- Copy tournament decks into a personal deck library
- Use responsive navigation, filters, Deck controls, and comparison layouts on
  mobile devices

### Tournament Analytics

- Browse cEDH tournaments
- Explore the Commander metagame
- Review regional tournament summaries
- Expand visual tournament Deck viewers directly on tournament pages
- Sort, group, preview, export, or duplicate tournament Decks
- Analyze Commander card-inclusion statistics
- Inspect card-inclusion trends over configurable time buckets
- View inclusion counts, sample sizes, and event counts directly on charts
- Filter relevant tournament samples by date, placement, and event size
- Explore Commander-scoped card support, confidence, and lift
- Protect association results with configurable sample thresholds
- Surface absent cards associated with multiple cards in a personal Deck
- Inspect exact supporting Deck counts, confidence, support, and lift
- Review recommendation evidence, inclusion history, and tournament
  appearances without leaving the Deck builder
- Ingest tournament data from TopDeck and EDHTop16

### Authentication

- Use the deck builder in guest mode without an account
- Synchronize authenticated deck libraries through Supabase
- Automatically transfer a meaningful guest draft after sign-in
- Keep private decks creator-only while allowing link access to unlisted decks

## Technology

### Frontend

- Vue 3
- TypeScript
- Vite
- Vuetify
- Pinia
- Vue Router

### Backend and Data

- Supabase
- PostgreSQL
- Supabase Edge Functions
- Scryfall
- TopDeck
- EDHTop16

### Quality and Deployment

- Vitest
- GitHub Actions
- GitHub Pages

Additional documentation:

- [Architecture](docs/ARCHITECTURE.md)
- [Supabase operations](docs/SUPABASE_OPERATIONS.md)
- [Tournament ingestion](docs/TOURNAMENT_INGESTION.md)

## Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Run the test suite:

```bash
npm run test
```

Check code quality and formatting:

```bash
npm run lint
npm run format:check
```

Apply safe lint and formatting fixes before opening a pull request:

```bash
npm run lint:fix
npm run format
```

ESLint covers Vue and TypeScript source, Stylelint enforces consistent Vue/CSS
rules and property ordering, and Prettier owns whitespace and punctuation.

Create a production build:

```bash
npm run build
```

The application runs in guest mode without Supabase credentials. To enable
authentication and cloud decks, copy `.env.example` to `.env.local` and
provide the browser-safe Supabase project URL and publishable key. Never expose
the Supabase service-role key in frontend environment variables.

After linking the development Supabase project, apply pending schema changes:

```bash
npx supabase db push --linked
```

## Environment Variables

```env
VITE_APP_NAME=DoomsdayMTG
VITE_APP_TAGLINE=Competitive Commander Deck Builder
VITE_BASE_PATH=/doomsday-mtg/
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

For a renamed GitHub Pages repository, change `VITE_BASE_PATH` to the new
repository path. Use `/` when deploying to a custom domain.

## Roadmap

### ✅ v0.1 — Core Deck Builder

- [x] Complete Commander deck builder
- [x] Compatible partner Commander selection
- [x] Mainboard, Sideboard, and Maybeboard management
- [x] Grid and list deck displays
- [x] Independent board grouping, ordering, and card sizing
- [x] Interactive card preview and card action menus
- [x] Deck validation with warning and error severity
- [x] Mana curve and deck-statistics visualization
- [x] Guest draft and authenticated cloud deck libraries
- [x] Plaintext import and export
- [x] Authentication
- [x] Cloud persistence
- [x] Automated testing

### ✅ v0.2 — Tournament Analytics

- [x] Tournament ingestion
- [x] Commander metagame
- [x] Regional analytics
- [x] Tournament deck processing
- [x] Canonical card identities
- [x] Card-inclusion analytics
- [x] Time-bucketed card-inclusion trends
- [x] Inclusion chart tooltips, event counts, and configurable periods
- [x] Tournament deck viewer

### ✅ v0.3 — Deck Comparison

- [x] Compare personal decks against tournament averages
- [x] Missing core cards
- [x] Flex slot analysis
- [x] Deck similarity scoring
- [x] Separate owned cards from usual missing inclusions
- [x] Copy tournament decklists into a personal library

### ✅ v0.3.1 — Data Stabilization

- [x] Data health dashboard
- [x] Analytics readiness reporting
- [x] Unresolved-card diagnostics
- [x] Comparison consistency checks
- [x] Production smoke-test tooling

### ✅ v0.3.2 — Deck Sharing, Customization, and Presentation

- [x] Private, unlisted, and public deck visibility
- [x] Creator attribution and deck descriptions
- [x] Public deck discovery and unlisted link access
- [x] Deck copying with configurable title and visibility
- [x] Inline deck-title editing
- [x] Persistent user defaults for display, grouping, and visibility
- [x] Configurable deck-builder search side
- [x] Persisted Deck Statistics placement groundwork for future layouts
- [x] Independent board display and card-size preferences
- [x] Multi-Deck deletion and visibility actions
- [x] Read-only public and shared Deck presentation
- [x] Printing and foil selection for Deck cards and Commanders
- [x] Printing-specific TCGplayer prices and Deck totals
- [x] Card-art-derived app themes with the Oracle theme as default
- [x] Dedicated responsive mobile navigation and content layouts
- [x] Consistent inline SVG icon and theme-contrast system
- [x] Animated, reduced-motion-aware Oracle branding

### ✅ v0.4 — Card Association Engine

- [x] Commander-scoped pairwise support, confidence, and lift
- [x] Complete tournament Deck and Oracle-identity boundaries
- [x] Association RPC filters for date, region, event size, and placement
- [x] Configurable minimum-sample protection
- [x] Unnamed connected-group detection groundwork

### ✅ v0.5 — Association-Based Card Suggestions

- [x] Commander-scoped suggestions from personal mainboard associations
- [x] Multiple supporting-card evidence
- [x] Exact joint and source Deck counts
- [x] Existing association sample and threshold filters
- [x] Runtime-validated batched suggestion responses
- [x] Explicit non-causal, non-strategic explanations
- [x] Commander event filtering by up to five Oracle-identified cards

### ✅ v0.5.1 — Suggestion UX Consolidation

- [x] Embedded Top Recommendations panel in the Deck builder
- [x] Timeframe controls, reload behavior, and queued recommendation backfill
- [x] Card-shaped skeleton loading states
- [x] One-click Mainboard additions
- [x] Detailed association-evidence dialog
- [x] Confidence and lift strength presentation
- [x] Card and tournament inclusion history
- [x] Tournament Deck drill-down
- [x] Commander-page association and inclusion dialogs
- [x] Responsive recommendation cards and evidence layouts

### 🚧 v0.6 — Association Package Discovery

- [x] Return unnamed connected association clusters
- [ ] Evaluate stable archetype and package clustering
- [ ] Compare package prevalence across tournament samples
- [ ] Add user-reviewed package naming and presentation

## Inspiration

- Moxfield
- Archidekt
- TopDeck
- EDHTop16
- Scryfall

## License

MIT
