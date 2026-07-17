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
- Select a commander
- Commander color identity restrictions
- Deck model written in TypeScript
- Responsive Vue 3 interface
- Current deck saved locally in the browser
- Plaintext decklist import and export

The current deck remains only in this browser. Clearing browser storage can
remove it, and accounts or cloud synchronization are not yet supported.

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
- Mana font, exposed through local Vue mana-symbol components

For module boundaries, state ownership, the import pipeline, persistence
migration, and testing conventions, see
[Architecture](docs/ARCHITECTURE.md).

Available routes:

- `#/` — Home
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

## Phase 1 — MVP 🚧 *(Current)*

- [x] Vue project setup
- [x] TypeScript models
- [x] Commander selection
- [x] Card search
- [x] Add/remove cards
- [x] Commander legality filtering
- [ ] Deck statistics
- [x] Import/Export decklists
- [x] Save decks locally

---

## Phase 2 — Deck Builder

- [ ] Mana curve visualization
- [ ] Color pip analysis
- [ ] Tagging system
- [ ] Multiple commanders / Partners
- [ ] Drag & drop sorting
- [ ] Land recommendations

---

## Phase 3 — Data Collection

- [ ] Tournament scraper
- [ ] Deck database
- [ ] Commander archetype detection
- [ ] Card inclusion statistics
- [ ] Historical tournament tracking

---

## Phase 4 — Analytics

- [ ] Deck comparison engine
- [ ] Card association graph
- [ ] Package detection
- [ ] Meta reports
- [ ] Win-rate analysis

---

## Phase 5 — Intelligent Recommendations

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
