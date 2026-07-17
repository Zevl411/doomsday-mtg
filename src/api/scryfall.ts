// `import type` imports TypeScript information without adding runtime code.
import type { ScryfallCard } from '../types/card'

// TODO: baseurl this bitch
const BASE_URL = "https://api.scryfall.com"

// An interface describes the shape of the JSON returned by Scryfall search.
interface ScryfallSearchResponse {
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
