import type {
  ScryfallCard,
  ScryfallImageUris,
} from '../types/card'

export type CardImageSize = keyof ScryfallImageUris

/**
 * Scryfall stores images on the card for normal layouts and on each face for
 * double-faced layouts. UI components call this helper so they do not need to
 * know which response shape they received.
 */
export function getCardImage(
  card: ScryfallCard,
  preferredSize: CardImageSize = 'normal',
): string | undefined {
  const images = card.image_uris ?? card.card_faces?.[0]?.image_uris

  if (!images) {
    return undefined
  }

  // Fall back toward smaller images because older or unusual records may not
  // expose every size even though the initial model marks common sizes present.
  return (
    images[preferredSize] ??
    images.normal ??
    images.small ??
    images.large
  )
}

/** Produces one consistent, human-readable color identity label. */
export function formatColorIdentity(card: ScryfallCard): string {
  return card.color_identity.join(', ') || 'Colorless'
}

/** Chips need an array even for a colorless card, so provide a display value. */
export function getColorIdentityLabels(card: ScryfallCard): string[] {
  return card.color_identity.length ? card.color_identity : ['Colorless']
}
