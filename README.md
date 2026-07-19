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
tournament ingestion from TopDeck and EDHTop16; normalized tournament
decklists; regional tracking; and Commander card analytics.

Current focus: card-association analysis and recommendation groundwork.

## Features

### Deck Builder

- Search the complete Magic card database through Scryfall
- Select individual or rules-compatible paired Commanders
- Validate Commander color identity and deck size
- Enforce singleton rules with basic-land quantity exceptions
- Maintain multiple authenticated decks or one browser-local guest draft
- Organize Mainboard, Sideboard, and Maybeboard cards in grid or list views
- Group and order cards by name, mana value, card type, or color
- Inspect deck statistics, card-type counts, and an interactive mana curve
- Configure deck visibility as private, unlisted, or public
- Add deck descriptions and attribution to the deck creator
- Copy, rename, delete, import, and export decks
- Customize default display, grouping, visibility, search placement, and
  statistics placement through user preferences
- Import and export plaintext decklists
- Copy tournament decks into a personal deck library

### Tournament Analytics

- Browse normalized cEDH tournaments
- Explore the Commander metagame
- Review regional tournament summaries
- View normalized tournament decklists
- Analyze Commander card-inclusion statistics
- Inspect card-inclusion trends over configurable time buckets
- View inclusion counts, sample sizes, and event counts directly on charts
- Filter by date, placement, event size, and region
- Explore Commander-scoped card support, confidence, and lift
- Protect association results with configurable sample thresholds
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

Create a production build:

```bash
npm run build
```

The application runs in guest mode without Supabase credentials. To enable
authentication and cloud decks, copy `.env.example` to `.env.local` and
provide the browser-safe Supabase project URL and publishable key. Never expose
the Supabase service-role key in frontend environment variables.

## Environment Variables

```env
VITE_APP_NAME=DoomsdayMTG
VITE_APP_TAGLINE=Competitive Commander Deck Builder
VITE_BASE_PATH=/doomsday-mtg/
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

### 🚧 v0.2 — Tournament Intelligence

- [x] Tournament ingestion
- [x] Commander metagame
- [x] Regional analytics
- [x] Tournament deck normalization
- [x] Canonical card identities
- [x] Card-inclusion analytics
- [x] Time-bucketed card-inclusion trends
- [x] Inclusion chart tooltips, event counts, and configurable periods
- [x] Tournament deck viewer

### v0.3 — Deck Comparison

- [x] Compare personal decks against tournament averages
- [x] Missing core cards
- [x] Flex slot analysis
- [x] Deck similarity scoring
- [x] Separate owned cards from usual missing inclusions
- [x] Copy tournament decklists into a personal library

### v0.3.1 — Data Stabilization

- [x] Data health dashboard
- [x] Analytics readiness reporting
- [x] Unresolved-card diagnostics
- [x] Comparison consistency checks
- [x] Production smoke-test tooling

### ✅ v0.3.2 — Deck Sharing and Builder Customization

- [x] Private, unlisted, and public deck visibility
- [x] Creator attribution and deck descriptions
- [x] Public deck discovery and unlisted link access
- [x] Deck copying with configurable title and visibility
- [x] Inline deck-title editing
- [x] Persistent user defaults for display, grouping, and visibility
- [x] Configurable deck-builder search side
- [x] Configurable Deck Statistics placement
- [x] Independent board display and card-size preferences
- [x] Animated, reduced-motion-aware Oracle branding

### ✅ v0.4 — Card Association Engine

- [x] Commander-scoped pairwise support, confidence, and lift
- [x] Complete normalized Deck and Oracle-identity boundaries
- [x] Date, region, event-size, and placement filters
- [x] Configurable minimum-sample protection
- [x] Unnamed connected-group detection groundwork
- [ ] Archetype clustering
- [ ] Regional package trends

### v0.5 — Intelligent Recommendations

- [ ] Commander-aware recommendations
- [ ] Package recommendations
- [ ] Suggested additions
- [ ] Suggested cuts
- [ ] Replacement analysis
- [ ] Confidence scoring

## Inspiration

- Moxfield
- Archidekt
- TopDeck
- EDHTop16
- Scryfall

## License

MIT
