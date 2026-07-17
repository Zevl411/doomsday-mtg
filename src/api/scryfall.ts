// `import type` imports TypeScript information without adding runtime code.
import type { ScryfallCard } from '../types/card'

const BASE_URL = 'https://api.scryfall.com'
// Scryfall asks clients to stay below ten requests per second.
const LOOKUP_INTERVAL_MS = 100
const COLLECTION_BATCH_SIZE = 75
let lastLookupStartedAt = 0

// An interface describes the shape of the JSON returned by Scryfall search.
interface ScryfallSearchResponse {
  data: ScryfallCard[]
}

interface ScryfallCollectionResponse {
  data: ScryfallCard[]
}

// `async` functions return a Promise. The type inside Promise describes the
// value callers receive after awaiting the request.
export async function searchCards(
  query: string,
  signal?: AbortSignal,
): Promise<ScryfallCard[]> {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    return []
  }

  const encodedQuery = encodeURIComponent(trimmedQuery)
  const response = await fetchFromScryfall(
    `${BASE_URL}/cards/search?q=${encodedQuery}`,
    {
      headers: { Accept: 'application/json' },
      signal,
    },
    signal,
  )

  if (response.status === 404) {
    throw new Error('No matching cards found.')
  }

  if (!response.ok) {
    throw createScryfallResponseError('search', response)
  }

  const result: ScryfallSearchResponse = await response.json()
  return result.data
}

/**
 * Resolves normalized names through Scryfall's collection endpoint. Importing
 * a Commander deck therefore needs two requests instead of roughly one hundred.
 */
export async function getCardsByExactNames(
  names: string[],
  signal?: AbortSignal,
): Promise<ScryfallCard[]> {
  const uniqueNames = getUniqueCardNames(names)
  const cards: ScryfallCard[] = []

  // Scryfall accepts at most 75 identifiers in one collection request.
  for (
    let index = 0;
    index < uniqueNames.length;
    index += COLLECTION_BATCH_SIZE
  ) {
    const batch = uniqueNames.slice(index, index + COLLECTION_BATCH_SIZE)
    await waitForLookupTurn(signal)

    const response = await fetchFromScryfall(
      `${BASE_URL}/cards/collection`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifiers: batch.map((name) => ({ name })),
        }),
        signal,
      },
      signal,
    )

    if (!response.ok) {
      throw createScryfallResponseError('collection lookup', response)
    }

    const result: ScryfallCollectionResponse = await response.json()
    cards.push(...result.data)
  }

  return cards
}

function getUniqueCardNames(names: string[]): string[] {
  const namesByLowercaseValue = new Map<string, string>()

  for (const name of names) {
    const trimmedName = name.trim()
    const lookupKey = trimmedName.toLowerCase()

    // Preserve the first spelling for readable request debugging while using a
    // case-insensitive key to avoid redundant identifiers.
    if (trimmedName && !namesByLowercaseValue.has(lookupKey)) {
      namesByLowercaseValue.set(lookupKey, trimmedName)
    }
  }

  return Array.from(namesByLowercaseValue.values())
}

export async function isCommanderEligible(
  cardName: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const escapedName = cardName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  try {
    const cards = await searchCards(
      `!"${escapedName}" is:commander legal:commander`,
      signal,
    )
    return cards.length > 0
  } catch (error) {
    if (error instanceof Error && error.message === 'No matching cards found.') {
      return false
    }
    throw error
  }
}

/**
 * Enforces the shared request cadence. The abort listener clears the pending
 * timer so closing an import dialog does not leave background work behind.
 */
async function waitForLookupTurn(signal?: AbortSignal): Promise<void> {
  const elapsed = Date.now() - lastLookupStartedAt
  const delay = Math.max(0, LOOKUP_INTERVAL_MS - elapsed)

  if (delay > 0) {
    await new Promise<void>((resolve, reject) => {
      const handleAbort = () => {
        window.clearTimeout(timer)
        reject(new DOMException('The request was aborted.', 'AbortError'))
      }
      const timer = window.setTimeout(() => {
        signal?.removeEventListener('abort', handleAbort)
        resolve()
      }, delay)

      signal?.addEventListener(
        'abort',
        handleAbort,
        { once: true },
      )
    })
  }

  if (signal?.aborted) {
    throw new DOMException('The request was aborted.', 'AbortError')
  }

  lastLookupStartedAt = Date.now()
}

async function fetchFromScryfall(
  url: string,
  options: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  try {
    return await fetch(url, options)
  } catch (error) {
    // AbortError is intentional lifecycle cleanup and must remain distinguishable
    // from a real network outage to callers.
    if (signal?.aborted) {
      throw error
    }

    throw new Error('Unable to reach Scryfall. Please try again.')
  }
}

function createScryfallResponseError(
  operation: string,
  response: Response,
): Error {
  if (response.status === 429) {
    return new Error(
      'Scryfall is temporarily rate-limiting requests. Please wait and try again.',
    )
  }

  return new Error(
    `Scryfall ${operation} failed (${response.status} ${response.statusText}).`,
  )
}
