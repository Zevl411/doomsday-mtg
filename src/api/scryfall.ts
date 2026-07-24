// `import type` imports TypeScript information without adding runtime code.
import type { ScryfallCard } from '../types/card';

const BASE_URL = 'https://api.scryfall.com';
// Scryfall asks clients to stay below ten requests per second.
const LOOKUP_INTERVAL_MS = 100;
const COLLECTION_BATCH_SIZE = 75;
let lastLookupStartedAt = 0;
const cardPrintingCache = new Map<string, ScryfallCard>();

export type ScryfallSearchUniqueMode = 'cards' | 'art' | 'prints';

/** Lets callers distinguish an outage from a valid empty search result. */
export class ScryfallUnavailableError extends Error {
  override name = 'ScryfallUnavailableError';
}

// An interface describes the shape of the JSON returned by Scryfall search.
// `async` functions return a Promise. The type inside Promise describes the
// value callers receive after awaiting the request.
export async function searchCards(
  query: string,
  signal?: AbortSignal,
  uniqueMode: ScryfallSearchUniqueMode = 'cards',
): Promise<ScryfallCard[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const encodedQuery = encodeURIComponent(trimmedQuery);
  const uniqueParameter = uniqueMode === 'cards' ? '' : `&unique=${uniqueMode}`;
  const response = await fetchFromScryfall(
    `${BASE_URL}/cards/search?q=${encodedQuery}${uniqueParameter}`,
    {
      headers: { Accept: 'application/json' },
      signal,
    },
    signal,
  );

  if (response.status === 404) {
    throw new Error('No matching cards found.');
  }

  if (!response.ok) {
    throw createScryfallResponseError('search', response);
  }

  return await readCardList(response, 'search');
}

/**
 * Resolves normalized names through Scryfall's collection endpoint. Importing
 * a Commander deck therefore needs two requests instead of roughly one hundred.
 */
export async function getCardsByExactNames(
  names: string[],
  signal?: AbortSignal,
): Promise<ScryfallCard[]> {
  const uniqueNames = getUniqueCardNames(names);
  const cards: ScryfallCard[] = [];

  // Scryfall accepts at most 75 identifiers in one collection request.
  for (let index = 0; index < uniqueNames.length; index += COLLECTION_BATCH_SIZE) {
    const batch = uniqueNames.slice(index, index + COLLECTION_BATCH_SIZE);
    const collectionNames = Array.from(new Set(batch.map(getCollectionLookupName)));
    await waitForLookupTurn(signal);

    const response = await fetchFromScryfall(
      `${BASE_URL}/cards/collection`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifiers: collectionNames.map((name) => ({ name })),
        }),
        signal,
      },
      signal,
    );

    if (!response.ok) {
      throw createScryfallResponseError('collection lookup', response);
    }

    const batchCards = await readCardList(response, 'collection lookup');
    cards.push(...batchCards);

    // The collection endpoint does not resolve flavor names and may not accept
    // a full modal double-faced name. Retry only genuinely unresolved original
    // names through the exact-name endpoint instead of reverting the whole
    // import to one request per card.
    const unresolvedNames = batch.filter((originalName) => {
      const lookupName = getCollectionLookupName(originalName);
      return !batchCards.some((card) => getCardLookupNames(card).has(lookupName.toLowerCase()));
    });

    for (const unresolvedName of unresolvedNames) {
      const fallbackCard = await getCardByExactName(unresolvedName, signal);
      if (fallbackCard) {
        cards.push(fallbackCard);
      }
    }
  }

  return cards;
}

/** Resolves Oracle identities in collection-sized batches for display data. */
export async function getCardsByOracleIds(
  oracleIds: string[],
  signal?: AbortSignal,
): Promise<ScryfallCard[]> {
  const uniqueIds = [...new Set(oracleIds.map((id) => id.trim().toLowerCase()).filter(Boolean))];
  const cards: ScryfallCard[] = [];

  for (let index = 0; index < uniqueIds.length; index += COLLECTION_BATCH_SIZE) {
    await waitForLookupTurn(signal);
    const response = await fetchFromScryfall(
      `${BASE_URL}/cards/collection`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifiers: uniqueIds
            .slice(index, index + COLLECTION_BATCH_SIZE)
            .map((oracleId) => ({ oracle_id: oracleId })),
        }),
        signal,
      },
      signal,
    );
    if (!response.ok) {
      throw createScryfallResponseError('Oracle collection lookup', response);
    }
    cards.push(...(await readCardList(response, 'Oracle collection lookup')));
  }

  return cards;
}

/** Resolves exact printings in collection-sized batches for Deck totals. */
export async function getCardsByIds(
  cardIds: string[],
  signal?: AbortSignal,
): Promise<ScryfallCard[]> {
  const uniqueIds = [...new Set(cardIds.map((id) => id.trim()).filter(Boolean))];
  const cards: ScryfallCard[] = [];

  for (let index = 0; index < uniqueIds.length; index += COLLECTION_BATCH_SIZE) {
    const batch = uniqueIds.slice(index, index + COLLECTION_BATCH_SIZE);
    await waitForLookupTurn(signal);
    const response = await fetchFromScryfall(
      `${BASE_URL}/cards/collection`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifiers: batch.map((id) => ({ id })),
        }),
        signal,
      },
      signal,
    );
    if (!response.ok) {
      throw createScryfallResponseError('printing collection lookup', response);
    }
    const batchCards = await readCardList(response, 'printing collection lookup');
    for (const card of batchCards) {
      cardPrintingCache.set(card.id, card);
      cards.push(card);
    }
  }

  return cards;
}

/**
 * Refreshes one exact printing. Card previews use this for older saved Decks
 * that predate persisted marketplace fields; caching prevents repeated price
 * requests while moving the preview between cards.
 */
export async function getCardById(cardId: string, signal?: AbortSignal): Promise<ScryfallCard> {
  const cached = cardPrintingCache.get(cardId);
  if (cached) return cached;

  await waitForLookupTurn(signal);
  const response = await fetchFromScryfall(
    `${BASE_URL}/cards/${encodeURIComponent(cardId)}`,
    {
      headers: { Accept: 'application/json' },
      signal,
    },
    signal,
  );
  if (!response.ok) {
    throw createScryfallResponseError('printing lookup', response);
  }

  const value = await readJson(response, 'printing lookup');
  if (!isScryfallCard(value)) {
    throw invalidScryfallResponseError('printing lookup');
  }
  cardPrintingCache.set(cardId, value);
  return value;
}

/**
 * Returns every English paper printing for the same Oracle card. Following
 * Scryfall pagination is important for heavily reprinted staples and basics;
 * deck identity remains unchanged when one of these records is selected.
 */
export async function getCardPrintings(
  card: ScryfallCard,
  signal?: AbortSignal,
): Promise<ScryfallCard[]> {
  const query = card.oracle_id
    ? `oracleid:${card.oracle_id} game:paper lang:en`
    : `!"${escapeSearchPhrase(card.name)}" game:paper lang:en`;
  const initialUrl = new URL(`${BASE_URL}/cards/search`);
  initialUrl.searchParams.set('q', query);
  initialUrl.searchParams.set('unique', 'prints');
  initialUrl.searchParams.set('order', 'released');
  initialUrl.searchParams.set('dir', 'desc');

  const printings: ScryfallCard[] = [];
  const seenIds = new Set<string>();
  const visitedPages = new Set<string>();
  let nextUrl: string | null = initialUrl.toString();

  while (nextUrl) {
    if (visitedPages.has(nextUrl)) {
      throw invalidScryfallResponseError('printing lookup');
    }
    visitedPages.add(nextUrl);
    await waitForLookupTurn(signal);
    const response = await fetchFromScryfall(
      nextUrl,
      {
        headers: { Accept: 'application/json' },
        signal,
      },
      signal,
    );
    if (!response.ok) {
      throw createScryfallResponseError('printing lookup', response);
    }

    const page = await readCardPage(response, 'printing lookup');
    for (const printing of page.cards) {
      if (!seenIds.has(printing.id)) {
        seenIds.add(printing.id);
        printings.push(printing);
      }
    }
    nextUrl = validateScryfallPageUrl(page.nextPage);
  }

  return printings;
}

function validateScryfallPageUrl(value: string | null): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidScryfallResponseError('printing lookup');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'api.scryfall.com' ||
    url.pathname !== '/cards/search'
  ) {
    throw invalidScryfallResponseError('printing lookup');
  }
  return url.toString();
}

function getCollectionLookupName(name: string): string {
  // Scryfall collection identifiers reliably accept the front face even when
  // a source export supplied the complete modal double-faced name.
  return name.split('//')[0]?.trim() ?? name;
}

function escapeSearchPhrase(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getCardLookupNames(card: ScryfallCard): Set<string> {
  const names = [
    card.name,
    card.flavor_name,
    card.printed_name,
    ...(card.card_faces?.flatMap((face) => [face.name, face.printed_name]) ?? []),
    card.name.split('//')[0],
  ];

  return new Set(
    names.filter((name): name is string => Boolean(name)).map((name) => name.trim().toLowerCase()),
  );
}

async function getCardByExactName(
  name: string,
  signal?: AbortSignal,
): Promise<ScryfallCard | null> {
  await waitForLookupTurn(signal);
  const encodedName = encodeURIComponent(name.trim());
  const response = await fetchFromScryfall(
    `${BASE_URL}/cards/named?exact=${encodedName}`,
    {
      headers: { Accept: 'application/json' },
      signal,
    },
    signal,
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw createScryfallResponseError('exact-name lookup', response);
  }

  const value = await readJson(response, 'exact-name lookup');
  if (!isScryfallCard(value)) {
    throw invalidScryfallResponseError('exact-name lookup');
  }
  return value;
}

function getUniqueCardNames(names: string[]): string[] {
  const namesByLowercaseValue = new Map<string, string>();

  for (const name of names) {
    const trimmedName = name.trim();
    const lookupKey = trimmedName.toLowerCase();

    // Preserve the first spelling for readable request debugging while using a
    // case-insensitive key to avoid redundant identifiers.
    if (trimmedName && !namesByLowercaseValue.has(lookupKey)) {
      namesByLowercaseValue.set(lookupKey, trimmedName);
    }
  }

  return Array.from(namesByLowercaseValue.values());
}

export async function isCommanderEligible(
  cardName: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const escapedName = cardName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  try {
    const cards = await searchCards(`!"${escapedName}" is:commander legal:commander`, signal);
    return cards.length > 0;
  } catch (error) {
    if (error instanceof Error && error.message === 'No matching cards found.') {
      return false;
    }
    throw error;
  }
}

/**
 * Enforces the shared request cadence. The abort listener clears the pending
 * timer so closing an import dialog does not leave background work behind.
 */
async function waitForLookupTurn(signal?: AbortSignal): Promise<void> {
  const elapsed = Date.now() - lastLookupStartedAt;
  const delay = Math.max(0, LOOKUP_INTERVAL_MS - elapsed);

  if (delay > 0) {
    await new Promise<void>((resolve, reject) => {
      const handleAbort = () => {
        window.clearTimeout(timer);
        reject(new DOMException('The request was aborted.', 'AbortError'));
      };
      const timer = window.setTimeout(() => {
        signal?.removeEventListener('abort', handleAbort);
        resolve();
      }, delay);

      signal?.addEventListener('abort', handleAbort, { once: true });
    });
  }

  if (signal?.aborted) {
    throw new DOMException('The request was aborted.', 'AbortError');
  }

  lastLookupStartedAt = Date.now();
}

async function fetchFromScryfall(
  url: string,
  options: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error) {
    // AbortError is intentional lifecycle cleanup and must remain distinguishable
    // from a real network outage to callers.
    if (signal?.aborted) {
      throw error;
    }

    throw new ScryfallUnavailableError('Unable to reach Scryfall. Please try again.');
  }
}

function createScryfallResponseError(operation: string, response: Response): Error {
  if (response.status === 429) {
    return new ScryfallUnavailableError(
      'Scryfall is temporarily rate-limiting requests. Please wait and try again.',
    );
  }

  const message = `Scryfall ${operation} failed (${response.status} ${response.statusText}).`;
  return response.status >= 500 ? new ScryfallUnavailableError(message) : new Error(message);
}

/**
 * Network JSON starts as `unknown`: a successful HTTP status does not prove
 * that an upstream response still matches the fields used by the application.
 */
async function readCardList(response: Response, operation: string): Promise<ScryfallCard[]> {
  const value = await readJson(response, operation);
  if (!isRecord(value) || !Array.isArray(value.data) || !value.data.every(isScryfallCard)) {
    throw invalidScryfallResponseError(operation);
  }
  return value.data;
}

async function readCardPage(
  response: Response,
  operation: string,
): Promise<{ cards: ScryfallCard[]; nextPage: string | null }> {
  const value = await readJson(response, operation);
  if (
    !isRecord(value) ||
    !Array.isArray(value.data) ||
    !value.data.every(isScryfallCard) ||
    (value.has_more !== undefined && typeof value.has_more !== 'boolean') ||
    (value.next_page !== undefined && typeof value.next_page !== 'string')
  ) {
    throw invalidScryfallResponseError(operation);
  }

  const hasMore = value.has_more === true;
  if (hasMore && typeof value.next_page !== 'string') {
    throw invalidScryfallResponseError(operation);
  }
  const nextPage = hasMore && typeof value.next_page === 'string' ? value.next_page : null;
  return {
    cards: value.data,
    nextPage,
  };
}

function isScryfallCard(value: unknown): value is ScryfallCard {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.type_line === 'string' &&
    Array.isArray(value.color_identity) &&
    value.color_identity.every((color) => typeof color === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invalidScryfallResponseError(operation: string): Error {
  return new Error(`Scryfall ${operation} returned an unexpected response. Please try again.`);
}

async function readJson(response: Response, operation: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw invalidScryfallResponseError(operation);
  }
}
