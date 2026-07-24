import type { DeckCard } from '../models/deck';
import type { NormalizedTournamentDeckCard } from '../models/tournament';
import type { ScryfallCard } from '../types/card';

export function createTournamentCardLookup(cards: ScryfallCard[]) {
  const lookup = new Map<string, ScryfallCard>();
  for (const card of cards) {
    addLookupName(lookup, card.name, card);
    for (const face of card.card_faces ?? []) {
      addLookupName(lookup, face.name, card);
    }
  }
  return lookup;
}

export function toCopiedDeckCard(
  card: NormalizedTournamentDeckCard,
  lookup: Map<string, ScryfallCard>,
): DeckCard {
  const resolved = lookup.get(normalizeName(card.cardName));
  if (resolved) {
    return {
      quantity: card.quantity,
      card: {
        ...resolved,
        color_identity: [...resolved.color_identity],
        image_uris: resolved.image_uris ? { ...resolved.image_uris } : undefined,
        card_faces: resolved.card_faces?.map((face) => ({
          ...face,
          image_uris: face.image_uris ? { ...face.image_uris } : undefined,
        })),
      },
    };
  }

  const imageUrl = card.scryfallId
    ? `https://api.scryfall.com/cards/${encodeURIComponent(card.scryfallId)}?format=image&version=normal`
    : undefined;
  return {
    quantity: card.quantity,
    card: {
      id: card.scryfallId ?? card.oracleId ?? card.normalizedCardKey,
      oracle_id: card.oracleId,
      name: card.cardName,
      type_line: card.typeLine ?? '',
      color_identity: card.colorIdentity,
      cmc: card.manaValue,
      image_uris: imageUrl ? { small: imageUrl, normal: imageUrl, large: imageUrl } : undefined,
    },
  };
}

function addLookupName(lookup: Map<string, ScryfallCard>, name: string, card: ScryfallCard) {
  lookup.set(normalizeName(name), card);
}

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}
