import type { ScryfallCard } from '../types/card'

export function getCardIdentity(card: ScryfallCard): string {
  // Different printings still represent the same card for singleton rules.
  return card.oracle_id ?? normalizeCardIdentityName(card.name)
}

function normalizeCardIdentityName(name: string): string {
  return name
    .replace(/\s*\/{1,2}\s*/g, ' // ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
