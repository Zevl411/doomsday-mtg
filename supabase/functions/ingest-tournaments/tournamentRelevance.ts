export const DEFAULT_EXCLUDED_TITLE_KEYWORDS = [
  'budget',
  'casual',
  'precon',
  'pre-con',
  'beginner',
  'learn to play',
  'low power',
  'mid power',
  'battlecruiser',
  'commander party',
]

export interface TournamentRelevance {
  included: boolean
  matchedKeyword?: string
}

/**
 * TopDeck identifies Commander as EDH but does not provide a competitive tag.
 * Reject only explicit negative signals; never require cEDH in the title.
 */
export function evaluateTournamentTitle(
  title: string,
  excludedKeywords = DEFAULT_EXCLUDED_TITLE_KEYWORDS,
): TournamentRelevance {
  const normalizedTitle = normalize(title)
  const matchedKeyword = excludedKeywords.find((keyword) =>
    containsPhrase(normalizedTitle, normalize(keyword))
  )
  return matchedKeyword
    ? { included: false, matchedKeyword }
    : { included: true }
}

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function containsPhrase(title: string, phrase: string) {
  return Boolean(phrase) && (` ${title} `).includes(` ${phrase} `)
}
