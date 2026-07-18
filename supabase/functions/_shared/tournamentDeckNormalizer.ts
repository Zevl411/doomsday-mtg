export type TournamentDeckBoard =
  | 'commander' | 'mainboard' | 'sideboard' | 'maybeboard'
  | 'considering' | 'companion' | 'unknown'

export interface CardCandidate {
  board: TournamentDeckBoard
  name: string
  quantity: number
}

export interface CandidateIssue {
  code: string
  message: string
  input?: string
}

export interface CandidateResult {
  cards: CardCandidate[]
  issues: CandidateIssue[]
}

export type DeckCompletenessStatus = 'complete' | 'partial' | 'unavailable'

const BOARD_NAMES: Record<string, TournamentDeckBoard> = {
  commander: 'commander',
  commanders: 'commander',
  'command zone': 'commander',
  main: 'mainboard',
  deck: 'mainboard',
  mainboard: 'mainboard',
  maindeck: 'mainboard',
  sideboard: 'sideboard',
  side: 'sideboard',
  maybeboard: 'maybeboard',
  maybe: 'maybeboard',
  considering: 'considering',
  companion: 'companion',
}

// TopDeck includes non-card objects beside actual deck boards. These values
// describe the export or optional play aids and must never become card names.
const IGNORED_STRUCTURED_SECTIONS = new Set([
  'metadata',
  'stickers',
  'attractions',
  'tokens',
])

/** Structured TopDeck data is preferred because headings cannot become cards. */
export function normalizeStructuredDeck(value: unknown): CandidateResult {
  if (!isRecord(value)) {
    return { cards: [], issues: [{ code: 'invalid', message: 'Structured deck data is invalid.' }] }
  }
  const cards: CardCandidate[] = []
  const issues: CandidateIssue[] = []
  for (const [sectionName, section] of Object.entries(value)) {
    const normalizedSectionName = normalizeHeading(sectionName)
    if (IGNORED_STRUCTURED_SECTIONS.has(normalizedSectionName)) continue
    const board = BOARD_NAMES[normalizedSectionName] ?? 'unknown'
    if (board === 'unknown') {
      issues.push({
        code: 'unsupported_board',
        message: `Unsupported deck section: ${sectionName}.`,
      })
      // Unknown objects may contain provider metadata. Reporting the section
      // is safer than treating its property names as Magic cards.
      continue
    }
    for (const candidate of readStructuredSection(section)) {
      if (!candidate.name || candidate.quantity <= 0) {
        issues.push({
          code: 'malformed_quantity',
          message: 'A structured card entry was malformed.',
        })
      } else {
        cards.push({ board, ...candidate })
      }
    }
  }
  return { cards: combineCandidates(cards, issues), issues }
}

/** Mirrors the application parser's headings, annotations, and DFC spelling. */
export function normalizePlaintextDeck(text: string): CandidateResult {
  const cards: CardCandidate[] = []
  const issues: CandidateIssue[] = []
  let board: TournamentDeckBoard = 'mainboard'
  for (const original of text.split(/\r?\n/)) {
    const input = original.trim()
    if (!input) continue
    const heading = BOARD_NAMES[normalizeHeading(input)]
    if (heading) {
      board = heading
      continue
    }
    const inline = input.match(/^([a-z ]+):\s*(.+)$/i)
    const inlineBoard = inline
      ? BOARD_NAMES[normalizeHeading(inline[1] ?? '')]
      : undefined
    const cardInput = (inlineBoard ? inline?.[2] : input)?.trim() ?? ''
    const match = cardInput.replace(/\s+#.*$/, '').match(/^(\d+)(?:x)?\s+(.+)$/i)
    const quantity = match ? Number(match[1]) : 1
    const name = normalizeCardName(match?.[2] ?? cardInput)
    if (!name || !Number.isInteger(quantity) || quantity <= 0) {
      issues.push({
        code: 'malformed_quantity',
        message: 'Quantity must be a positive whole number.',
        input: original,
      })
      continue
    }
    cards.push({ board: inlineBoard ?? board, name, quantity })
  }
  return { cards: combineCandidates(cards, issues), issues }
}

export function normalizeCardKey(name: string) {
  return normalizeCardName(name).toLocaleLowerCase().replace(/\s+/g, ' ')
}

/** Completeness is deterministic and accepts the two-Commander pairs supported by the app. */
export function evaluateDeckCompleteness(
  candidates: CardCandidate[],
  unresolvedCount: number,
  existingIssues: CandidateIssue[],
): { status: DeckCompletenessStatus; issues: CandidateIssue[] } {
  const issues: CandidateIssue[] = []
  if (!candidates.length) return { status: 'unavailable', issues }
  const commanderCount = sumBoard(candidates, 'commander')
  const mainboardCount = sumBoard(candidates, 'mainboard')
  const total = commanderCount + mainboardCount
  if (commanderCount < 1) {
    issues.push({ code: 'missing_commander', message: 'No Commander section was found.' })
  }
  if (commanderCount > 2) {
    issues.push({ code: 'unsupported_commanders', message: 'More than two Commanders were found.' })
  }
  if (total < 98 || total > 101) {
    issues.push({
      code: 'incomplete_mainboard',
      message: `Commander and mainboard contain ${total} cards; expected approximately 100.`,
    })
  }
  if (unresolvedCount) {
    issues.push({
      code: 'unresolved_cards',
      message: `${unresolvedCount} card name(s) were unresolved.`,
    })
  }
  const hasBlockingParserIssue = existingIssues.some((issue) =>
    ['malformed_quantity', 'unsupported_board'].includes(issue.code)
  )
  return {
    status: issues.length || hasBlockingParserIssue ? 'partial' : 'complete',
    issues,
  }
}

function readStructuredSection(value: unknown): Array<{ name: string; quantity: number }> {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return [{ name: normalizeCardName(item), quantity: 1 }]
      if (!isRecord(item)) return []
      const name = stringValue(item.name ?? item.cardName)
      const quantity = Number(item.quantity ?? item.count ?? 1)
      return name ? [{ name: normalizeCardName(name), quantity }] : []
    })
  }
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([name, details]) => {
    const quantity = typeof details === 'number'
      ? details
      : isRecord(details) ? Number(details.quantity ?? details.count ?? 1) : 1
    return [{ name: normalizeCardName(name), quantity }]
  })
}

function combineCandidates(cards: CardCandidate[], issues: CandidateIssue[]) {
  const combined = new Map<string, CardCandidate>()
  for (const card of cards) {
    const key = `${card.board}|${normalizeCardKey(card.name)}`
    const existing = combined.get(key)
    if (existing) {
      existing.quantity += card.quantity
      issues.push({
        code: 'duplicate_normalized_card',
        message: `${card.name} appeared more than once in ${card.board}.`,
      })
    } else combined.set(key, { ...card })
  }
  return [...combined.values()]
}

function sumBoard(candidates: CardCandidate[], board: TournamentDeckBoard) {
  return candidates.filter((card) => card.board === board)
    .reduce((total, card) => total + card.quantity, 0)
}

function normalizeHeading(value: string) {
  return value
    .replace(/^[#>*_~\-\s]+|[#>*_~\-\s:]+$/g, '')
    .trim()
    .toLocaleLowerCase()
}

function normalizeCardName(value: string) {
  return value
    .replace(/\s+\([A-Z0-9]{2,6}\)\s+\S+(?:\s+\*[^*]+\*)?\s*$/, '')
    .replace(/\s*\/{1,2}\s*/g, ' // ')
    .trim()
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
