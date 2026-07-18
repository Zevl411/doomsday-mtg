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
export function applyScryfallImages(
  cards: TournamentDeckCard[],
  scryfallCards: ScryfallCard[],
): TournamentDeckCard[] {
  const images = new Map<string, string>()

  for (const card of scryfallCards) {
    addImage(
      images,
      card.name,
      card.image_uris?.small ?? card.image_uris?.normal,
    )

    for (const face of card.card_faces ?? []) {
      addImage(
        images,
        face.name,
        face.image_uris?.small ??
          face.image_uris?.normal ??
          card.image_uris?.small ??
          card.image_uris?.normal,
      )
    }
  }

  return cards.map((card) => ({
    ...card,
    imageUrl: images.get(card.name.trim().toLowerCase()) ?? card.imageUrl,
  }))
}

function addImage(
  images: Map<string, string>,
  name: string,
  imageUrl?: string,
) {
  if (imageUrl) images.set(name.trim().toLowerCase(), imageUrl)
}
