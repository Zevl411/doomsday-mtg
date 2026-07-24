import type { ScryfallCard, ScryfallImageUris } from '../types/card';

export type CardImageSize = keyof ScryfallImageUris;

/**
 * Scryfall stores images on the card for normal layouts and on each face for
 * double-faced layouts. UI components call this helper so they do not need to
 * know which response shape they received.
 */
export function getCardImage(
  card: ScryfallCard,
  preferredSize: CardImageSize = 'normal',
): string | undefined {
  const images = card.image_uris ?? card.card_faces?.[0]?.image_uris;

  if (!images) {
    return undefined;
  }

  // Fall back toward smaller images because older or unusual records may not
  // expose every size even though the initial model marks common sizes present.
  return images[preferredSize] ?? images.normal ?? images.small ?? images.large;
}

/** Returns a specific printed face image without falling back to another face. */
export function getCardFaceImage(
  card: ScryfallCard,
  faceIndex: number,
  preferredSize: CardImageSize = 'normal',
): string | undefined {
  const images = card.card_faces?.[faceIndex]?.image_uris;
  if (!images) return undefined;

  return images[preferredSize] ?? images.normal ?? images.small ?? images.large;
}

/**
 * Deck tiles use the illustration instead of the complete printed card. New
 * Scryfall responses provide art_crop directly; the URL conversion preserves
 * the same printing for older saved decks that predate that stored field.
 */
export function getCardArt(card: ScryfallCard): string | undefined {
  const images = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  if (!images) return undefined;

  return (
    images.art_crop ?? toArtCropUrl(images.large) ?? toArtCropUrl(images.normal) ?? images.large
  );
}

function toArtCropUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.hostname !== 'cards.scryfall.io') return undefined;

    const parts = url.pathname.split('/');
    const renditionIndex = parts.findIndex((part) =>
      ['small', 'normal', 'large', 'png', 'border_crop'].includes(part),
    );
    if (renditionIndex === -1) return undefined;

    parts[renditionIndex] = 'art_crop';
    url.pathname = parts.join('/').replace(/\.png$/i, '.jpg');
    return url.toString();
  } catch {
    return undefined;
  }
}
