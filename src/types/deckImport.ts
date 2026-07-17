import type { Deck } from '../models/deck'

/** Source formats influence parsing heuristics but never the Deck model. */
export type DecklistFormat =
  | 'generic'
  | 'moxfield'
  | 'archidekt'
  | 'arena'
  | 'mtgo'

/**
 * The parser recognizes more boards than the application currently stores.
 * Untracked boards remain explicit so they can be summarized rather than lost
 * or misreported as card names.
 */
export type DeckBoard =
  | 'commander'
  | 'mainboard'
  | 'sideboard'
  | 'maybeboard'
  | 'considering'
  | 'companion'
  | 'acquireboard'
  | 'tokens'
  | 'unknown'

export type DecklistSection = DeckBoard

export interface ParsedDeckLine {
  quantity: number
  cardName: string
  lineNumber: number
  section: DeckBoard
  originalText?: string
}

/** A user-facing parser, resolution, or legality problem. */
export interface DeckImportIssue {
  lineNumber?: number
  input?: string
  message: string
}

/** Summary shown before a potentially lossy import is confirmed. */
export interface DeckImportResult {
  format: DecklistFormat
  importedCards: number
  skippedCards: number
  issues: DeckImportIssue[]
  informationalIssues: DeckImportIssue[]
  ignoredSections: IgnoredDeckSection[]
  commanderSource: 'imported' | 'inferred' | 'retained' | 'required' | 'none'
}

/** Fully normalized, network-free output from the plaintext parser. */
export interface ParsedDecklist {
  format: DecklistFormat
  lines: ParsedDeckLine[]
  issues: DeckImportIssue[]
  ignoredSections: IgnoredDeckSection[]
  hasCommanderSection: boolean
  commanderInferenceMayBeRequired: boolean
  skippedCategoryHeadings: DeckImportIssue[]
}

export interface IgnoredDeckSection {
  section: DecklistSection
  cardCount: number
}

export interface PreparedDeckImport {
  deck: Deck
  result: DeckImportResult
}
