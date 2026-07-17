import type {
  DeckBoard,
  DeckImportIssue,
  DecklistFormat,
  IgnoredDeckSection,
  ParsedDeckLine,
  ParsedDecklist,
} from '../types/deckImport'
import { detectDecklistFormat } from './decklistFormat'
import {
  getDecklistBoardHeading,
  normalizeDecklistHeading,
} from './decklistHeadings'

const UNTRACKED_BOARDS = new Set<DeckBoard>([
  'companion',
  'acquireboard',
  'tokens',
])

const INLINE_BOARD_PREFIXES: Record<string, DeckBoard> = {
  commander: 'commander',
  sideboard: 'sideboard',
  side: 'sideboard',
  maybeboard: 'maybeboard',
  maybe: 'maybeboard',
  considering: 'considering',
  consider: 'considering',
}

const COMMON_CATEGORY_HEADINGS = new Set([
  'artifact',
  'artifacts',
  'creature',
  'creatures',
  'enchantment',
  'enchantments',
  'instant',
  'instants',
  'sorcery',
  'sorceries',
  'land',
  'lands',
  'ramp',
  'removal',
  'interaction',
  'card draw',
  'win conditions',
])

export function parseDecklist(
  text: string,
  selectedFormat?: DecklistFormat,
): ParsedDecklist {
  const originalLines = text.split(/\r?\n/)
  const format = selectedFormat ?? detectDecklistFormat(text)
  const lines: ParsedDeckLine[] = []
  const issues: DeckImportIssue[] = []
  const skippedCategoryHeadings: DeckImportIssue[] = []
  const ignoredCounts = new Map<DeckBoard, number>()
  let currentSection: DeckBoard = 'mainboard'
  let hasCommanderSection = false
  let hasCommanderPrefix = false

  originalLines.forEach((originalLine, index) => {
    const input = originalLine.trim()
    const lineNumber = index + 1

    if (!input) {
      return
    }

    const recognizedSection = getDecklistBoardHeading(input)

    if (recognizedSection) {
      currentSection = recognizedSection
      if (recognizedSection === 'commander') {
        hasCommanderSection = true
      }
      return
    }

    const prefixedLine = getInlineBoardPrefix(input)
    const lineSection = prefixedLine?.board ?? currentSection
    const cardInput = prefixedLine?.cardText ?? input

    if (prefixedLine?.board === 'commander') {
      hasCommanderPrefix = true
      hasCommanderSection = true
    }

    if (
      (format === 'moxfield' || format === 'archidekt') &&
      lineSection === 'mainboard' &&
      isLikelyCategoryHeading(cardInput, originalLines, index)
    ) {
      skippedCategoryHeadings.push({
        lineNumber,
        input,
        message: 'Organizational category heading was skipped.',
      })
      return
    }

    if (UNTRACKED_BOARDS.has(lineSection)) {
      const ignoredLine = parseIgnoredLine(
        cardInput,
        lineNumber,
        lineSection,
        originalLine,
      )
      ignoredCounts.set(
        lineSection,
        (ignoredCounts.get(lineSection) ?? 0) + ignoredLine.quantity,
      )
      return
    }

    const parsedLine = parseCardLine(
      cardInput,
      lineNumber,
      lineSection,
      originalLine,
    )

    if ('message' in parsedLine) {
      issues.push(parsedLine)
    } else {
      lines.push(parsedLine)
    }
  })

  const ignoredSections: IgnoredDeckSection[] = Array.from(
    ignoredCounts,
    ([section, cardCount]) => ({ section, cardCount }),
  )

  return {
    format,
    lines,
    issues,
    ignoredSections,
    hasCommanderSection,
    commanderInferenceMayBeRequired:
      !hasCommanderSection && !hasCommanderPrefix && lines.length > 0,
    skippedCategoryHeadings,
  }
}

function getInlineBoardPrefix(
  input: string,
): { board: DeckBoard; cardText: string } | null {
  const match = input.match(/^([a-z ]+):\s*(.+)$/i)

  if (!match) {
    return null
  }

  const prefix = normalizeDecklistHeading(match[1] ?? '')
  const board = INLINE_BOARD_PREFIXES[prefix]

  return board
    ? { board, cardText: (match[2] ?? '').trim() }
    : null
}

function parseCardLine(
  input: string,
  lineNumber: number,
  section: DeckBoard,
  originalText: string,
): ParsedDeckLine | DeckImportIssue {
  const withoutComment = input.replace(/\s+#.*$/, '').trim()
  const quantityMatch = withoutComment.match(/^(\d+)(?:x)?\s+(.+)$/i)

  if (quantityMatch) {
    const quantity = Number(quantityMatch[1])
    const cardName = normalizeCardName(quantityMatch[2] ?? '')

    if (!Number.isInteger(quantity) || quantity <= 0 || !cardName) {
      return createQuantityIssue(lineNumber, originalText)
    }

    return { quantity, cardName, lineNumber, section, originalText }
  }

  if (
    /^[+-]?\d+(?:\.\d+)?x?(?:\s|$)/i.test(withoutComment) ||
    /^\d+x\S/i.test(withoutComment)
  ) {
    return createQuantityIssue(lineNumber, originalText)
  }

  const cardName = normalizeCardName(withoutComment)

  if (!cardName) {
    return {
      lineNumber,
      input: originalText,
      message: 'Card name is required.',
    }
  }

  return { quantity: 1, cardName, lineNumber, section, originalText }
}

function parseIgnoredLine(
  input: string,
  lineNumber: number,
  section: DeckBoard,
  originalText: string,
): ParsedDeckLine {
  const withoutComment = input.replace(/\s+#.*$/, '').trim()
  const quantityMatch = withoutComment.match(/^(\d+)(?:x)?\s+(.+)$/i)
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 1

  return {
    quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
    cardName: normalizeCardName(quantityMatch?.[2] ?? withoutComment),
    lineNumber,
    section,
    originalText,
  }
}

function normalizeCardName(value: string): string {
  // Arena, Moxfield, and Archidekt may append printing details. Requiring
  // both a set code and collector number preserves parentheses in card names.
  return value
    .replace(/\s+\([A-Z0-9]{2,6}\)\s+\S+(?:\s+\*[^*]+\*)?\s*$/, '')
    .trim()
}

function createQuantityIssue(
  lineNumber: number,
  input: string,
): DeckImportIssue {
  return {
    lineNumber,
    input,
    message: 'Quantity must be a positive whole number.',
  }
}

function isLikelyCategoryHeading(
  input: string,
  lines: string[],
  index: number,
): boolean {
  if (/^\d+x?\s+/i.test(input)) {
    return false
  }

  const normalized = normalizeDecklistHeading(input)
  const isDecorative = normalized !== input.trim().toLowerCase()

  if (!COMMON_CATEGORY_HEADINGS.has(normalized) && !isDecorative) {
    return false
  }

  const nextContentLine = lines
    .slice(index + 1)
    .map((line) => line.trim())
    .find(Boolean)

  return Boolean(nextContentLine?.match(/^\d+x?\s+/i))
}
