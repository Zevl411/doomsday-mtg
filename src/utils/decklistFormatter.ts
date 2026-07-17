import type { Deck, DeckCard } from '../models/deck'

export function formatDecklist(deck: Deck): string {
  const sections: string[] = []

  if (deck.commander) {
    const commanders = [
      deck.commander,
      deck.partnerCommander,
    ].filter((card) => card !== null && card !== undefined)
    sections.push(
      `Commander\n${commanders.map((card) => `1 ${card.name}`).join('\n')}`,
    )
  }

  addBoardSection(sections, 'Mainboard', deck.cards)
  addBoardSection(sections, 'Sideboard', deck.sideboard)
  addBoardSection(sections, 'Maybeboard', deck.maybeboard)
  addBoardSection(sections, 'Considering', deck.considering)

  return sections.join('\n\n')
}

function addBoardSection(
  sections: string[],
  heading: string,
  cards: DeckCard[],
) {
  if (!cards.length) {
    return
  }

  // Copying before sort() keeps the Pinia store array in its current order.
  const sortedCards = [...cards].sort((first, second) =>
    first.card.name.localeCompare(second.card.name),
  )
  const lines = [
    heading,
    ...sortedCards.map(
      (deckCard) => `${deckCard.quantity} ${deckCard.card.name}`,
    ),
  ]
  sections.push(lines.join('\n'))
}
