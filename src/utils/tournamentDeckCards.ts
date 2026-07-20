import type { TournamentDeckCard } from '../models/tournament'
import type { ScryfallCard } from '../types/card'

/** Combines repeated cards while preserving the first card's display data. */
export function groupTournamentDeckCards(
  cards: TournamentDeckCard[],
): TournamentDeckCard[] {
  const grouped = new Map<string, TournamentDeckCard>()

  for (const card of cards) {
    const key = card.oracleId ?? card.name.trim().toLowerCase()
    const existing = grouped.get(key)

    if (existing) {
      existing.quantity += card.quantity
    } else {
      grouped.set(key, { ...card })
    }
  }

  return [...grouped.values()]
}

/**
 * Provider image URLs are not always optimized for a large grid. Scryfall's
 * image CDN is more reliable, so resolved cards replace provider URLs.
 */
export function applyScryfallCardDetails(
  cards: TournamentDeckCard[],
  scryfallCards: ScryfallCard[],
): TournamentDeckCard[] {
  const details = new Map<string, ScryfallCard>()

  for (const card of scryfallCards) {
    addCardDetails(details, card.name, card)

    for (const face of card.card_faces ?? []) {
      addCardDetails(details, face.name, card)
    }
  }

  return cards.map((card) => {
    const resolved = details.get(card.name.trim().toLowerCase())
    return {
      ...card,
      typeLine:
        resolved?.card_faces?.[0]?.type_line ??
        resolved?.type_line ??
        card.typeLine,
      manaCost: resolved?.mana_cost ?? card.manaCost,
      manaValue: resolved?.cmc ?? card.manaValue,
      colorIdentity: resolved?.color_identity ?? card.colorIdentity ?? [],
      imageUrl:
        resolved?.image_uris?.small ??
        resolved?.image_uris?.normal ??
        resolved?.card_faces?.[0]?.image_uris?.small ??
        resolved?.card_faces?.[0]?.image_uris?.normal ??
        card.imageUrl,
      backImageUrl:
        resolved?.card_faces?.[1]?.image_uris?.small ??
        resolved?.card_faces?.[1]?.image_uris?.normal ??
        card.backImageUrl,
    }
  })
}

function addCardDetails(
  details: Map<string, ScryfallCard>,
  name: string,
  card: ScryfallCard,
) {
  details.set(name.trim().toLowerCase(), card)
}

export type TournamentDeckSort = 'name' | 'mana-value' | 'card-type'

export interface ExportableTournamentCard {
  name: string
  quantity: number
}

/**
 * Stored counts let the UI detect older normalized snapshots that silently
 * omitted a card, including DFCs affected by earlier identity parsing.
 */
export function hasExpectedTournamentDeckCards(
  commanders: TournamentDeckCard[],
  cards: TournamentDeckCard[],
  expectedMainboardCount?: number,
): boolean {
  const mainboardCount = cards.reduce(
    (total, card) => total + card.quantity,
    0,
  )
  return (
    commanders.length > 0 &&
    (
      expectedMainboardCount === undefined ||
      mainboardCount >= expectedMainboardCount
    )
  )
}

/** Uses the same simple plaintext sections accepted by the Deck importer. */
export function formatTournamentDecklist(
  commanders: ExportableTournamentCard[],
  cards: ExportableTournamentCard[],
): string {
  const sections: string[] = []
  addExportSection(sections, 'Commander', commanders)
  addExportSection(sections, 'Mainboard', cards)
  return sections.join('\n\n')
}

/** Returns a sorted copy so cached provider Deck data is never mutated. */
export function sortTournamentDeckCards(
  cards: TournamentDeckCard[],
  sort: TournamentDeckSort,
): TournamentDeckCard[] {
  return [...cards].sort((left, right) => {
    if (sort === 'mana-value') {
      const manaDifference =
        (left.manaValue ?? Number.MAX_SAFE_INTEGER) -
        (right.manaValue ?? Number.MAX_SAFE_INTEGER)
      if (manaDifference !== 0) return manaDifference
    }

    if (sort === 'card-type') {
      const typeDifference = getSortableCardType(left.typeLine).localeCompare(
        getSortableCardType(right.typeLine),
      )
      if (typeDifference !== 0) return typeDifference
    }

    return left.name.localeCompare(right.name)
  })
}

function addExportSection(
  sections: string[],
  heading: string,
  cards: ExportableTournamentCard[],
) {
  if (!cards.length) return

  const lines = [...cards]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((card) => `${card.quantity} ${card.name}`)
  sections.push([heading, ...lines].join('\n'))
}

export function getSortableCardType(typeLine: string): string {
  // Supertypes such as "Legendary" should not separate otherwise similar
  // Creatures when the user asks to group the Deck by card type.
  return typeLine
    .split('—')[0]
    ?.replace(/\b(Basic|Legendary|Snow|World|Ongoing)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() ?? ''
}
