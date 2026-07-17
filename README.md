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

The current deck remains only in this browser. Clearing browser storage can
remove it, and accounts or cloud synchronization are not yet supported.

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

GitHub Pages deployment is configured at
`https://zevl411.github.io/doomsday-mtg/`. Pushes to `main` automatically build
and deploy the application.

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
- [ ] Commander legality filtering
- [ ] Deck statistics
- [ ] Import/Export decklists
- [ ] Save decks locally

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
