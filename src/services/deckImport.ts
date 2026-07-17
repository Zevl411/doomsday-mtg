import {
  getCardsByExactNames,
  isCommanderEligible,
} from '../api/scryfall'
import type { Deck, DeckCard } from '../models/deck'
import type {
  DeckBoard,
  DeckImportIssue,
  DecklistFormat,
  ParsedDeckLine,
  PreparedDeckImport,
} from '../types/deckImport'
import type { ScryfallCard } from '../types/card'
import { getCardIdentity } from '../utils/cardIdentity'
import { isBasicLand, validateCardAddition } from '../utils/deckLegality'
import { parseDecklist } from '../utils/decklistParser'

type ImportCardBoard =
  | 'mainboard'
  | 'sideboard'
  | 'maybeboard'
  | 'considering'

interface CombinedCard {
  card: ScryfallCard
  quantity: number
  firstLine: ParsedDeckLine
}

/**
 * Builds a complete candidate Deck without mutating the active Pinia store.
 *
 * Pipeline: parse -> batch resolve -> choose Commander -> group each board ->
 * validate only the mainboard -> return a reviewable result.
 */
export async function prepareDeckImport(
  text: string,
  currentDeck: Deck,
  signal?: AbortSignal,
  selectedFormat?: DecklistFormat,
): Promise<PreparedDeckImport> {
  const parsed = parseDecklist(text, selectedFormat)
  const issues: DeckImportIssue[] = [...parsed.issues]
  let importedCards = 0
  let skippedCards = parsed.issues.length
  const resolvableBoards = new Set<DeckBoard>([
    'commander',
    'mainboard',
    'sideboard',
    'maybeboard',
    'considering',
  ])
  const importableLines = parsed.lines.filter((line) =>
    resolvableBoards.has(line.section),
  )
  const lookupNames = Array.from(
    new Map(
      importableLines.map((line) => [
        line.cardName.trim().toLowerCase(),
        line.cardName,
      ]),
    ).values(),
  )

  // All tracked boards share one deduplicated lookup set. This both reduces API
  // load and guarantees that the same name resolves consistently everywhere.
  const resolvedBatch = await getCardsByExactNames(lookupNames, signal)
  const resolvedCards = createResolvedCardMap(resolvedBatch)
  let commander = parsed.hasCommanderSection
    ? null
    : currentDeck.commander
  let commanderSource:
    | 'imported'
    | 'inferred'
    | 'retained'
    | 'required'
    | 'none' = commander ? 'retained' : 'none'

  const commanderLines = parsed.lines.filter(
    (line) => line.section === 'commander',
  )

  for (const line of commanderLines) {
    const card = getResolvedCard(line, resolvedCards)

    if (!card) {
      issues.push(createUnknownCardIssue(line))
      skippedCards += line.quantity
      continue
    }

    if (commander) {
      issues.push({
        lineNumber: line.lineNumber,
        input: line.cardName,
        message: 'Only one Commander is supported.',
      })
      skippedCards += line.quantity
      continue
    }

    commander = card
    commanderSource = 'imported'
    importedCards += 1

    if (line.quantity > 1) {
      issues.push({
        lineNumber: line.lineNumber,
        input: line.cardName,
        message: 'Only one copy of the Commander was imported.',
      })
      skippedCards += line.quantity - 1
    }
  }

  let mainboardLines = parsed.lines.filter(
    (line) => line.section === 'mainboard',
  )

  if (
    parsed.commanderInferenceMayBeRequired &&
    isPlausibleCommanderList(mainboardLines, parsed.format)
  ) {
    const firstLine = mainboardLines[0]
    const firstCard = firstLine
      ? getResolvedCard(firstLine, resolvedCards)
      : null

    if (
      firstLine?.quantity === 1 &&
      firstCard &&
      await isCommanderEligible(firstCard.name, signal)
    ) {
      commander = firstCard
      commanderSource = 'inferred'
      importedCards += 1
      mainboardLines = mainboardLines.slice(1)
    }
  }

  if (!commander && !parsed.hasCommanderSection) {
    commanderSource = 'required'
  }

  const deck: Deck = {
    name: currentDeck.name,
    commander,
    cards: [],
    sideboard: [],
    maybeboard: [],
    considering: [],
  }

  const boardLines: Record<ImportCardBoard, ParsedDeckLine[]> = {
    mainboard: mainboardLines,
    sideboard: parsed.lines.filter((line) => line.section === 'sideboard'),
    maybeboard: parsed.lines.filter((line) => line.section === 'maybeboard'),
    considering: parsed.lines.filter((line) => line.section === 'considering'),
  }

  // Object.keys() returns string[] in TypeScript. The assertion is safe because
  // boardLines was created immediately above with every ImportCardBoard key.
  for (const board of Object.keys(boardLines) as ImportCardBoard[]) {
    const combinedCards = combineBoardCards(
      boardLines[board],
      resolvedCards,
      issues,
    )

    for (const combinedCard of combinedCards.values()) {
      if (board === 'mainboard') {
        const added = addMainboardCard(deck, combinedCard, issues)
        importedCards += added.imported
        skippedCards += added.skipped
      } else {
        getDeckBoard(deck, board).push({
          card: combinedCard.card,
          quantity: combinedCard.quantity,
        })
        importedCards += combinedCard.quantity
      }
    }

    skippedCards += boardLines[board]
      .filter((line) => !getResolvedCard(line, resolvedCards))
      .reduce((total, line) => total + line.quantity, 0)
  }

  return {
    deck,
    result: {
      format: parsed.format,
      importedCards,
      skippedCards,
      issues,
      informationalIssues: parsed.skippedCategoryHeadings,
      ignoredSections: parsed.ignoredSections,
      commanderSource,
    },
  }
}

function createResolvedCardMap(
  cards: ScryfallCard[],
): Map<string, ScryfallCard> {
  const resolvedCards = new Map<string, ScryfallCard>()

  for (const card of cards) {
    resolvedCards.set(card.name.trim().toLowerCase(), card)
    const frontFaceName = card.name.split('//')[0]?.trim().toLowerCase()
    if (frontFaceName) {
      resolvedCards.set(frontFaceName, card)
    }
  }

  return resolvedCards
}

function getResolvedCard(
  line: ParsedDeckLine,
  cards: Map<string, ScryfallCard>,
): ScryfallCard | null {
  return cards.get(line.cardName.trim().toLowerCase()) ?? null
}

function combineBoardCards(
  lines: ParsedDeckLine[],
  resolvedCards: Map<string, ScryfallCard>,
  issues: DeckImportIssue[],
): Map<string, CombinedCard> {
  const combinedCards = new Map<string, CombinedCard>()

  for (const line of lines) {
    const card = getResolvedCard(line, resolvedCards)

    if (!card) {
      issues.push(createUnknownCardIssue(line))
      continue
    }

    const identity = getCardIdentity(card)
    const existing = combinedCards.get(identity)
    if (existing) {
      existing.quantity += line.quantity
    } else {
      combinedCards.set(identity, {
        card,
        quantity: line.quantity,
        firstLine: line,
      })
    }
  }

  return combinedCards
}

function addMainboardCard(
  deck: Deck,
  combinedCard: CombinedCard,
  issues: DeckImportIssue[],
): { imported: number; skipped: number } {
  if (!deck.commander) {
    issues.push({
      lineNumber: combinedCard.firstLine.lineNumber,
      input: combinedCard.firstLine.cardName,
      message: 'Choose a Commander before importing main-deck cards.',
    })
    return { imported: 0, skipped: combinedCard.quantity }
  }

  const validation = validateCardAddition(combinedCard.card, deck)
  if (!validation.allowed) {
    issues.push({
      lineNumber: combinedCard.firstLine.lineNumber,
      input: combinedCard.firstLine.cardName,
      message:
        validation.reason ?? 'This card could not be imported into the deck.',
    })
    return { imported: 0, skipped: combinedCard.quantity }
  }

  const quantity = isBasicLand(combinedCard.card)
    ? combinedCard.quantity
    : 1
  deck.cards.push({ card: combinedCard.card, quantity })

  if (!isBasicLand(combinedCard.card) && combinedCard.quantity > 1) {
    const skipped = combinedCard.quantity - 1
    issues.push({
      lineNumber: combinedCard.firstLine.lineNumber,
      input: combinedCard.firstLine.cardName,
      message: `${skipped} duplicate copies were skipped.`,
    })
    return { imported: 1, skipped }
  }

  return { imported: quantity, skipped: 0 }
}

function getDeckBoard(
  deck: Deck,
  board: Exclude<ImportCardBoard, 'mainboard'>,
): DeckCard[] {
  return deck[board]
}

function isPlausibleCommanderList(
  lines: ParsedDeckLine[],
  format: DecklistFormat,
): boolean {
  const total = lines.reduce((sum, line) => sum + line.quantity, 0)

  // A selected/detected Moxfield list can be a useful partial export. For an
  // otherwise generic list, stay close to the expected 100-card shape.
  return format === 'moxfield'
    ? total >= 60 && total <= 120
    : total >= 90 && total <= 110
}

function createUnknownCardIssue(line: ParsedDeckLine): DeckImportIssue {
  return {
    lineNumber: line.lineNumber,
    input: line.cardName,
    message: 'No matching Scryfall card was found.',
  }
}
