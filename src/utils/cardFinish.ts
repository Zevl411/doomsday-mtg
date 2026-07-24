import type { ScryfallCard } from '../types/card'

/**
 * Older saved cards do not include finish metadata, so they remain permissive.
 * Newly resolved Scryfall records enforce whether this exact printing exists
 * with a traditional foil treatment.
 */
export function supportsFoil(card: ScryfallCard): boolean {
  if (card.finishes) return card.finishes.includes('foil')
  if (typeof card.foil === 'boolean') return card.foil
  return true
}
