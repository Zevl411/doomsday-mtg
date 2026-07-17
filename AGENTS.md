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
- GitHub Pages
- Browser localStorage for MVP persistence

## Coding guidelines

- Favor simple, readable code over clever abstractions.
- Use beginner-friendly TypeScript.
- Add comments when introducing unfamiliar TypeScript concepts.
- Avoid advanced generics unless clearly necessary.
- Keep components reasonably small.
- Explain architectural decisions in comments or documentation.
- Do not add dependencies unless they provide clear value.
- Run the build before considering work complete.
- Preserve Commander legality rules when modifying deck functionality.