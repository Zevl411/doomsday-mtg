// `import type` imports TypeScript information without adding runtime code.
import type { ScryfallCard } from '../types/card'

const BASE_URL = 'https://api.scryfall.com'
const LOOKUP_INTERVAL_MS = 100
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
  const response = await fetch(`${BASE_URL}/cards/search?q=${encodedQuery}`, {
    signal,
  })

  if (response.status === 404) {
    throw new Error('No matching cards found.')
  }

  if (!response.ok) {
    throw new Error(
      `Scryfall search failed (${response.status} ${response.statusText}).`,
    )
  }

  const result: ScryfallSearchResponse = await response.json()
  return result.data
}

export async function getCardByExactName(
  name: string,
  signal?: AbortSignal,
): Promise<ScryfallCard | null> {
  const trimmedName = name.trim()

  if (!trimmedName) {
    return null
  }

  let response: Response

  try {
    // Imports can resolve many cards in succession. Spacing exact-name
    // requests avoids overwhelming Scryfall while still keeping imports quick.
    await waitForLookupTurn(signal)

    const encodedName = encodeURIComponent(trimmedName)
    response = await fetch(`${BASE_URL}/cards/named?exact=${encodedName}`, {
      signal,
    })
  } catch (error) {
    if (signal?.aborted) {
      throw error
    }

    throw new Error('Unable to reach Scryfall. Please try again.')
  }

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(
      `Scryfall card lookup failed (${response.status} ${response.statusText}).`,
    )
  }

  return await response.json()
}

export async function getCardsByExactNames(
  names: string[],
  signal?: AbortSignal,
): Promise<ScryfallCard[]> {
  const uniqueNames = Array.from(
    new Map(
      names
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => [name.toLowerCase(), name]),
    ).values(),
  )
  const cards: ScryfallCard[] = []

  // Scryfall accepts at most 75 identifiers in one collection request.
  for (let index = 0; index < uniqueNames.length; index += 75) {
    const batch = uniqueNames.slice(index, index + 75)
    await waitForLookupTurn(signal)

    let response: Response

    try {
      response = await fetch(`${BASE_URL}/cards/collection`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifiers: batch.map((name) => ({ name })),
        }),
        signal,
      })
    } catch (error) {
      if (signal?.aborted) {
        throw error
      }

      throw new Error('Unable to reach Scryfall. Please try again.')
    }

    if (!response.ok) {
      throw new Error(
        `Scryfall collection lookup failed (${response.status} ${response.statusText}).`,
      )
    }

    const result: ScryfallCollectionResponse = await response.json()
    cards.push(...result.data)
  }

  return cards
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
