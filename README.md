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
tournament ingestion from TopDeck and EDHTop16, normalized tournament
decklists, regional tracking, and Commander card analytics. The next major
milestone is building deck comparison and intelligent recommendation systems.

## Features

### Deck Builder

- Search the complete Magic card database through Scryfall
- Select individual or rules-compatible paired Commanders
- Validate Commander color identity and deck size
- Enforce singleton rules with basic-land quantity exceptions
- Maintain multiple authenticated decks or one browser-local guest draft
- Import and export plaintext decklists
- Copy tournament decks into a personal deck library

### Tournament Analytics

- Browse normalized cEDH tournaments
- Explore the Commander metagame
- Review regional tournament summaries
- View normalized tournament decklists
- Analyze Commander card-inclusion statistics
- Filter by date, placement, event size, and region
- Ingest tournament data from TopDeck and EDHTop16

### Authentication

- Use the deck builder in guest mode without an account
- Synchronize authenticated deck libraries through Supabase
- Automatically transfer a meaningful guest draft after sign-in

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

## Configuration

The public name, tagline, and deployment base path can be changed without
editing Vue components:

```env
VITE_APP_NAME=DoomsdayMTG
VITE_APP_TAGLINE=Competitive Commander Deck Builder
VITE_BASE_PATH=/doomsday-mtg/
```

For a renamed GitHub Pages repository, change `VITE_BASE_PATH` to the new
repository path. Use `/` when deploying to a custom domain.

Hash-based routing is used so application routes continue to work when opened
or refreshed on GitHub Pages.

## Roadmap

### ✅ v0.1 — Core Deck Builder

- [x] Complete Commander deck builder
- [x] Guest draft and authenticated cloud deck libraries
- [x] Plaintext import and export
- [x] Authentication
- [x] Cloud persistence
- [x] Automated testing

### 🚧 v0.2 — Tournament Explorer

- [x] Tournament ingestion
- [x] Commander metagame
- [x] Regional analytics
- [x] Tournament deck normalization
- [x] Canonical card identities
- [x] Card-inclusion analytics
- [x] Tournament deck viewer

### v0.3 — Deck Comparison

- [ ] Compare personal decks with tournament averages
- [ ] Identify missing core cards
- [ ] Analyze flex slots
- [ ] Calculate deck-similarity scores

### v0.4 — Card Association Engine

- [ ] Pairwise card statistics
- [ ] Package detection
- [ ] Archetype clustering
- [ ] Regional package trends

### v0.5 — Intelligent Recommendations

- [ ] Commander-aware recommendations
- [ ] Package recommendations
- [ ] Suggested additions and cuts
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
