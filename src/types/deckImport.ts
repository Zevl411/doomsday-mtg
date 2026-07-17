import type { Deck } from '../models/deck'

export type DecklistFormat =
  | 'generic'
  | 'moxfield'
  | 'archidekt'
  | 'arena'
  | 'mtgo'

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

export interface DeckImportIssue {
  lineNumber?: number
  input?: string
  message: string
}

export interface DeckImportResult {
  format: DecklistFormat
  importedCards: number
  skippedCards: number
  issues: DeckImportIssue[]
  informationalIssues: DeckImportIssue[]
  ignoredSections: IgnoredDeckSection[]
  commanderSource: 'imported' | 'inferred' | 'retained' | 'required' | 'none'
}

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
