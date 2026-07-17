# DoomsdayMTG Development Instructions

DoomsdayMTG is a competitive Commander deck-building web application.

## MVP goals

- Search Magic: The Gathering cards using Scryfall.
- Select a legal Commander.
- Add and remove cards from a deck.
- Enforce Commander color identity.
- Validate deck size and singleton rules.
- Save decks locally in the browser.
- Import and export decklists.
- Eventually analyze competitive EDH tournament decklists and recommend associated cards.

## Technology

- Vue 3
- TypeScript
- Vite
- npm
- Vuetify
- Pinia
- Vue Router with hash history
- Vitest and Vue Test Utils
- GitHub Pages
- Browser localStorage for MVP persistence

## Coding guidelines

- Favor simple, readable code over clever abstractions.
- Use beginner-friendly TypeScript.
- Treat documentation as part of the implementation, not optional polish.
- Give every non-trivial module, exported domain type, and multi-step workflow
  a short comment explaining its responsibility and boundary.
- Comment why a rule, threshold, state transition, regex, or workaround exists.
- Explain unfamiliar Vue and TypeScript syntax near its first use.
- Keep comments synchronized when behavior changes.
- Avoid comments that merely narrate obvious syntax such as “increment the
  quantity”; comments should capture intent, constraints, or architectural
  context that the code cannot express by itself.
- Avoid advanced generics unless clearly necessary.
- Keep components reasonably small.
- Explain architectural decisions in comments or documentation.
- Keep Scryfall transport in `src/api`, domain rules in `src/utils`, shared deck
  state in `src/stores`, and route composition in `src/views`.
- Keep parsing free of network calls. Import must normalize text before Scryfall
  resolution and must not mutate Pinia before user confirmation.
- Do not add dependencies unless they provide clear value.
- Add or update deterministic tests whenever behavior or a boundary changes.
- Run `npm run test` and `npm run build` before considering work complete.
- Preserve Commander legality rules when modifying deck functionality.
