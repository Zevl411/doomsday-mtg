import { createDeckId } from '../models/createDeck';
import { DECK_LIBRARY_VERSION, type StoredDeckLibrary } from '../models/deckLibrary';

import type { Deck, DeckCard, DeckVisibility } from '../models/deck';
import type {
  ScryfallCard,
  ScryfallCardFace,
  ScryfallCardPrices,
  ScryfallImageUris,
  ScryfallPurchaseUris,
} from '../types/card';

export const DECK_LIBRARY_STORAGE_KEY = 'doomsday-mtg-guest-library';
export const GUEST_DRAFT_STORAGE_KEY = 'doomsday-mtg-guest-draft';
export const LEGACY_LIBRARY_STORAGE_KEY = 'doomsday-mtg-deck-library';
export const LEGACY_DECK_STORAGE_KEY = 'doomsday-mtg-current-deck';

function createEmptyLibrary(): StoredDeckLibrary {
  return {
    version: DECK_LIBRARY_VERSION,
    activeDeckId: null,
    decks: [],
  };
}

// Record<string, unknown> describes an object whose values are not trusted yet.
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeCard(value: unknown): ScryfallCard | null {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.type_line !== 'string' ||
    !Array.isArray(value.color_identity) ||
    !value.color_identity.every((color) => typeof color === 'string')
  ) {
    return null;
  }

  const optionalStringFields = [
    'oracle_id',
    'flavor_name',
    'printed_name',
    'mana_cost',
    'oracle_text',
    'set',
    'set_name',
    'collector_number',
    'released_at',
    'rarity',
    'lang',
    'artist',
  ];
  if (
    optionalStringFields.some(
      (field) => value[field] !== undefined && typeof value[field] !== 'string',
    ) ||
    (value.foil !== undefined && typeof value.foil !== 'boolean') ||
    (value.nonfoil !== undefined && typeof value.nonfoil !== 'boolean') ||
    (value.finishes !== undefined &&
      (!Array.isArray(value.finishes) ||
        !value.finishes.every((finish) => typeof finish === 'string'))) ||
    (value.cmc !== undefined &&
      (typeof value.cmc !== 'number' || !Number.isFinite(value.cmc) || value.cmc < 0)) ||
    (value.tcgplayer_id !== undefined &&
      (typeof value.tcgplayer_id !== 'number' ||
        !Number.isInteger(value.tcgplayer_id) ||
        value.tcgplayer_id <= 0))
  ) {
    return null;
  }

  const imageUris = normalizeImageUris(value.image_uris);
  const cardFaces = normalizeCardFaces(value.card_faces);
  const prices = normalizePrices(value.prices);
  const purchaseUris = normalizePurchaseUris(value.purchase_uris);

  if (imageUris === null || cardFaces === null || prices === null || purchaseUris === null) {
    return null;
  }

  const card: ScryfallCard = {
    id: value.id,
    name: value.name,
    type_line: value.type_line,
    color_identity: [...value.color_identity],
  };

  // Assign optional fields only when present so a storage round trip does not
  // add enumerable `undefined` properties to otherwise unchanged cards.
  for (const field of optionalStringFields) {
    const optionalValue = getOptionalString(value, field);
    if (optionalValue !== undefined) {
      Object.assign(card, { [field]: optionalValue });
    }
  }
  if (typeof value.cmc === 'number') card.cmc = value.cmc;
  if (typeof value.tcgplayer_id === 'number') {
    card.tcgplayer_id = value.tcgplayer_id;
  }
  if (typeof value.foil === 'boolean') card.foil = value.foil;
  if (typeof value.nonfoil === 'boolean') card.nonfoil = value.nonfoil;
  if (Array.isArray(value.finishes)) {
    card.finishes = [...value.finishes];
  }
  if (imageUris !== undefined) card.image_uris = imageUris;
  if (cardFaces !== undefined) card.card_faces = cardFaces;
  if (prices !== undefined) card.prices = prices;
  if (purchaseUris !== undefined) card.purchase_uris = purchaseUris;
  if (
    isObject(value.legalities) &&
    Object.values(value.legalities).every((legality) => typeof legality === 'string')
  ) {
    card.legalities = { ...(value.legalities as Record<string, string>) };
  }
  return card;
}

function normalizePrices(value: unknown): ScryfallCardPrices | undefined | null {
  if (value === undefined) return undefined;
  if (!isObject(value)) return null;

  const prices: ScryfallCardPrices = {};
  for (const key of ['usd', 'usd_foil', 'usd_etched'] as const) {
    const price = value[key];
    if (price !== undefined && price !== null && typeof price !== 'string') {
      return null;
    }
    if (typeof price === 'string' || price === null) prices[key] = price;
  }
  return prices;
}

function normalizePurchaseUris(value: unknown): ScryfallPurchaseUris | undefined | null {
  if (value === undefined) return undefined;
  if (!isObject(value) || (value.tcgplayer !== undefined && typeof value.tcgplayer !== 'string')) {
    return null;
  }
  return typeof value.tcgplayer === 'string' ? { tcgplayer: value.tcgplayer } : {};
}

function normalizeImageUris(value: unknown): ScryfallImageUris | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (
    !isObject(value) ||
    typeof value.small !== 'string' ||
    typeof value.normal !== 'string' ||
    typeof value.large !== 'string'
  ) {
    return null;
  }

  const imageUris: ScryfallImageUris = {
    small: value.small,
    normal: value.normal,
    large: value.large,
  };
  if (typeof value.art_crop === 'string') {
    imageUris.art_crop = value.art_crop;
  }
  return imageUris;
}

function normalizeCardFaces(value: unknown): ScryfallCardFace[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const faces: ScryfallCardFace[] = [];

  for (const face of value) {
    if (
      !isObject(face) ||
      typeof face.name !== 'string' ||
      typeof face.type_line !== 'string' ||
      (face.printed_name !== undefined && typeof face.printed_name !== 'string') ||
      (face.mana_cost !== undefined && typeof face.mana_cost !== 'string') ||
      (face.oracle_text !== undefined && typeof face.oracle_text !== 'string')
    ) {
      return null;
    }

    const imageUris = normalizeImageUris(face.image_uris);
    if (imageUris === null) {
      return null;
    }

    faces.push({
      name: face.name,
      printed_name: getOptionalString(face, 'printed_name'),
      mana_cost: getOptionalString(face, 'mana_cost'),
      type_line: face.type_line,
      oracle_text: getOptionalString(face, 'oracle_text'),
      image_uris: imageUris,
    });
  }

  return faces;
}

function getOptionalString(object: Record<string, unknown>, key: string): string | undefined {
  const value = object[key];
  return typeof value === 'string' ? value : undefined;
}

function normalizeBoard(value: unknown): DeckCard[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const board: DeckCard[] = [];

  for (const entry of value) {
    if (
      !isObject(entry) ||
      typeof entry.quantity !== 'number' ||
      !Number.isFinite(entry.quantity) ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity <= 0 ||
      (entry.foil !== undefined && typeof entry.foil !== 'boolean')
    ) {
      return null;
    }

    const card = normalizeCard(entry.card);
    if (!card) {
      return null;
    }

    board.push({
      card,
      quantity: entry.quantity,
      ...(entry.foil === true ? { foil: true } : {}),
    });
  }

  return board;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return false;
  }

  // Comparing the normalized value rejects ambiguous locale date strings.
  return new Date(value).toISOString() === value;
}

function normalizeDeck(value: unknown, allowLegacyFields: boolean): Deck | null {
  if (!isObject(value) || typeof value.name !== 'string') {
    return null;
  }

  const commander = value.commander === null ? null : normalizeCard(value.commander);
  // Missing partnerCommander is valid for decks saved before partner support.
  const partnerCommander =
    value.partnerCommander === undefined || value.partnerCommander === null
      ? null
      : normalizeCard(value.partnerCommander);
  const cards = normalizeBoard(value.cards);

  if (value.commander !== null && !commander) {
    return null;
  }

  if (
    value.partnerCommander !== undefined &&
    value.partnerCommander !== null &&
    !partnerCommander
  ) {
    return null;
  }

  if (!cards) {
    return null;
  }

  const sideboard =
    value.sideboard === undefined && allowLegacyFields ? [] : normalizeBoard(value.sideboard);
  const maybeboard =
    value.maybeboard === undefined && allowLegacyFields ? [] : normalizeBoard(value.maybeboard);
  const considering =
    value.considering === undefined && allowLegacyFields ? [] : normalizeBoard(value.considering);

  if (!sideboard || !maybeboard || !considering) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const id =
    typeof value.id === 'string' && value.id ? value.id : allowLegacyFields ? createDeckId() : null;
  const createdAt = isIsoDate(value.createdAt)
    ? value.createdAt
    : allowLegacyFields
      ? timestamp
      : null;
  const updatedAt = isIsoDate(value.updatedAt)
    ? value.updatedAt
    : allowLegacyFields
      ? timestamp
      : null;

  if (!id || !createdAt || !updatedAt) {
    return null;
  }

  const deck: Deck = {
    id,
    name: value.name,
    createdAt,
    updatedAt,
    commander,
    ...(value.commanderFoil === true ? { commanderFoil: true } : {}),
    partnerCommander,
    ...(value.partnerCommanderFoil === true ? { partnerCommanderFoil: true } : {}),
    cards,
    sideboard,
    maybeboard,
    considering,
  };
  if (typeof value.description === 'string') {
    deck.description = value.description.slice(0, 500);
  }
  if (isDeckVisibility(value.visibility)) deck.visibility = value.visibility;
  if (typeof value.creatorUsername === 'string' && value.creatorUsername.trim()) {
    deck.creatorUsername = value.creatorUsername.trim();
  }
  return deck;
}

function isDeckVisibility(value: unknown): value is DeckVisibility {
  return value === 'private' || value === 'unlisted' || value === 'public';
}

export function isUsableDeck(value: unknown): value is Deck {
  return normalizeDeck(value, false) !== null;
}

function normalizeLibrary(value: unknown): StoredDeckLibrary | null {
  if (
    !isObject(value) ||
    value.version !== DECK_LIBRARY_VERSION ||
    !Array.isArray(value.decks) ||
    (value.activeDeckId !== null && typeof value.activeDeckId !== 'string')
  ) {
    return null;
  }

  const decks: Deck[] = [];
  const deckIds = new Set<string>();

  for (const storedDeck of value.decks) {
    const deck = normalizeDeck(storedDeck, false);
    if (!deck || deckIds.has(deck.id)) {
      return null;
    }

    deckIds.add(deck.id);
    decks.push(deck);
  }

  // A dangling active ID should not make otherwise valid decks disappear.
  const activeDeckId =
    typeof value.activeDeckId === 'string' && deckIds.has(value.activeDeckId)
      ? value.activeDeckId
      : null;

  return {
    version: DECK_LIBRARY_VERSION,
    activeDeckId,
    decks,
  };
}

export function saveDeckLibrary(
  library: StoredDeckLibrary,
  storageKey = DECK_LIBRARY_STORAGE_KEY,
): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(library));
    return true;
  } catch (error) {
    console.warn('The deck library could not be saved locally.', error);
    return false;
  }
}

/**
 * Loads the versioned library first, then performs a one-time legacy migration
 * only when no valid library exists. The old key is removed after—not before—
 * the new library has been saved successfully.
 */
export function loadDeckLibrary(
  storageKey = DECK_LIBRARY_STORAGE_KEY,
  migrateLegacy = true,
): StoredDeckLibrary {
  try {
    const libraryText = localStorage.getItem(storageKey);

    if (libraryText) {
      const library = normalizeLibrary(JSON.parse(libraryText));
      if (library) {
        return library;
      }
    }

    if (migrateLegacy) {
      const previousLibraryText = localStorage.getItem(LEGACY_LIBRARY_STORAGE_KEY);
      if (previousLibraryText) {
        const previousLibrary = normalizeLibrary(JSON.parse(previousLibraryText));
        if (previousLibrary) {
          if (saveDeckLibrary(previousLibrary, storageKey)) {
            localStorage.removeItem(LEGACY_LIBRARY_STORAGE_KEY);
          }
          return previousLibrary;
        }
      }
    }

    const legacyText = migrateLegacy ? localStorage.getItem(LEGACY_DECK_STORAGE_KEY) : null;
    if (!legacyText) {
      return createEmptyLibrary();
    }

    const migratedDeck = normalizeDeck(JSON.parse(legacyText), true);
    if (!migratedDeck) {
      return createEmptyLibrary();
    }

    const migratedLibrary: StoredDeckLibrary = {
      version: DECK_LIBRARY_VERSION,
      activeDeckId: migratedDeck.id,
      decks: [migratedDeck],
    };

    if (saveDeckLibrary(migratedLibrary, storageKey)) {
      localStorage.removeItem(LEGACY_DECK_STORAGE_KEY);
    }

    return migratedLibrary;
  } catch (error) {
    console.warn('Saved deck data was invalid and could not be loaded.', error);
    return createEmptyLibrary();
  }
}

export function clearDeckLibrary(storageKey = DECK_LIBRARY_STORAGE_KEY): boolean {
  try {
    localStorage.removeItem(storageKey);
    return true;
  } catch (error) {
    console.warn('The deck library could not be removed.', error);
    return false;
  }
}

interface StoredGuestDraft {
  version: 1;
  deck: Deck | null;
}

export function loadGuestDraft(): Deck | null {
  try {
    const text = localStorage.getItem(GUEST_DRAFT_STORAGE_KEY);
    if (text) {
      const value: unknown = JSON.parse(text);
      if (isObject(value) && value.version === 1) {
        return value.deck === null ? null : normalizeDeck(value.deck, false);
      }
      return null;
    }

    // Guest mode displays one active draft, but retain the full former local
    // library so every Deck can be transferred if the user later signs in.
    const previous = loadDeckLibrary();
    const active =
      previous.decks.find((deck) => deck.id === previous.activeDeckId) ?? previous.decks[0] ?? null;
    if (active) saveGuestDraft(active);
    return active;
  } catch (error) {
    console.warn('The guest draft could not be loaded.', error);
    return null;
  }
}

export function saveGuestDraft(deck: Deck | null): boolean {
  try {
    const value: StoredGuestDraft = { version: 1, deck };
    localStorage.setItem(GUEST_DRAFT_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('The guest draft could not be saved.', error);
    return false;
  }
}

export function clearGuestDraft(): boolean {
  try {
    localStorage.removeItem(GUEST_DRAFT_STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn('The guest draft could not be removed.', error);
    return false;
  }
}

export interface LocalDeckTransfer {
  decks: Deck[];
  preferredActiveId: string | null;
}

/** Collects both the current guest draft and any former multi-Deck library. */
export function loadLocalDecksForAccountTransfer(): LocalDeckTransfer {
  const guestDraft = loadGuestDraft();
  const library = loadDeckLibrary();
  const decksById = new Map<string, Deck>();

  for (const deck of library.decks) decksById.set(deck.id, deck);
  if (guestDraft) decksById.set(guestDraft.id, guestDraft);

  return {
    decks: [...decksById.values()],
    preferredActiveId: guestDraft?.id ?? library.activeDeckId ?? library.decks[0]?.id ?? null,
  };
}

/** Removes Deck keys only after every transferred ID is confirmed in cloud. */
export function clearLocalDecksAfterAccountTransfer(): boolean {
  const guestCleared = clearGuestDraft();
  const libraryCleared = clearDeckLibrary();
  try {
    localStorage.removeItem(LEGACY_LIBRARY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_DECK_STORAGE_KEY);
    return guestCleared && libraryCleared;
  } catch (error) {
    console.warn('Legacy deck data could not be removed.', error);
    return false;
  }
}
