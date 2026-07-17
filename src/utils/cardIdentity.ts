import type { ScryfallCard } from '../types/card'

export function getCardIdentity(card: ScryfallCard): string {
  // Different printings still represent the same card for singleton rules.
  return card.oracle_id ?? card.name.trim().toLowerCase()
}
