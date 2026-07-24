import type { Deck, DeckCard, DeckVisibility } from './deck';
import type { ScryfallCard } from '../types/card';

export const DEFAULT_DECK_NAME = 'Untitled Deck';

export function createDeckId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // The fallback is readable and sufficiently unique for an offline,
  // browser-local library. Modern production browsers use randomUUID().
  return `deck-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyDeck(
  name = DEFAULT_DECK_NAME,
  creatorUsername = 'Guest',
  visibility: DeckVisibility = 'public',
): Deck {
  const timestamp = new Date().toISOString();

  return {
    id: createDeckId(),
    name: normalizeDeckName(name),
    description: '',
    visibility,
    creatorUsername,
    createdAt: timestamp,
    updatedAt: timestamp,
    commander: null,
    partnerCommander: null,
    cards: [],
    sideboard: [],
    maybeboard: [],
    considering: [],
  };
}

export function cloneDeck(
  source: Deck,
  name?: string,
  visibility: DeckVisibility = 'unlisted',
  creatorUsername = source.creatorUsername,
): Deck {
  const timestamp = new Date().toISOString();

  return {
    id: createDeckId(),
    name: normalizeDeckName(name ?? `${source.name} Copy`),
    description: source.description ?? '',
    visibility,
    creatorUsername: creatorUsername || 'Unknown',
    createdAt: timestamp,
    updatedAt: timestamp,
    commander: source.commander ? cloneCard(source.commander) : null,
    ...(source.commanderFoil === true ? { commanderFoil: true } : {}),
    partnerCommander: source.partnerCommander ? cloneCard(source.partnerCommander) : null,
    ...(source.partnerCommanderFoil === true ? { partnerCommanderFoil: true } : {}),
    cards: cloneBoard(source.cards),
    sideboard: cloneBoard(source.sideboard),
    maybeboard: cloneBoard(source.maybeboard),
    considering: cloneBoard(source.considering),
  };
}

export function normalizeDeckName(name: string): string {
  return name.trim() || DEFAULT_DECK_NAME;
}

function cloneBoard(board: DeckCard[]): DeckCard[] {
  return board.map((entry) => ({
    card: cloneCard(entry.card),
    quantity: entry.quantity,
    ...(entry.foil === true ? { foil: true } : {}),
  }));
}

function cloneCard(card: ScryfallCard): ScryfallCard {
  return {
    ...card,
    color_identity: [...card.color_identity],
    finishes: card.finishes ? [...card.finishes] : undefined,
    prices: card.prices ? { ...card.prices } : undefined,
    purchase_uris: card.purchase_uris ? { ...card.purchase_uris } : undefined,
    image_uris: card.image_uris ? { ...card.image_uris } : undefined,
    card_faces: card.card_faces?.map((face) => ({
      ...face,
      image_uris: face.image_uris ? { ...face.image_uris } : undefined,
    })),
  };
}
