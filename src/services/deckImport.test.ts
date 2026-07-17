import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getCardsByExactNames,
  isCommanderEligible,
} from '../api/scryfall'
import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import { prepareDeckImport } from './deckImport'

vi.mock('../api/scryfall', () => ({
  getCardsByExactNames: vi.fn(),
  isCommanderEligible: vi.fn(),
}))

function createCard(
  id: string,
  name: string,
  oracleId: string,
  typeLine = 'Artifact',
  colorIdentity: string[] = [],
): ScryfallCard {
  return {
    id,
    oracle_id: oracleId,
    name,
    type_line: typeLine,
    color_identity: colorIdentity,
  }
}

const commander = createCard(
  'commander-printing',
  'Commander',
  'commander-oracle',
  'Legendary Creature',
  ['U'],
)
const solRing = createCard('sol-ring-printing', 'Sol Ring', 'sol-ring-oracle')
const island = createCard(
  'island-printing',
  'Island',
  'island-oracle',
  'Basic Land — Island',
  ['U'],
)
const currentDeck: Deck = {
  name: 'Current Deck',
  commander,
  cards: [],
  sideboard: [],
  maybeboard: [],
  considering: [],
}

afterEach(() => {
  vi.mocked(getCardsByExactNames).mockReset()
  vi.mocked(isCommanderEligible).mockReset()
})

function mockCards(cards: ScryfallCard[]) {
  vi.mocked(getCardsByExactNames).mockImplementation(async (names) => {
    return cards.filter((card) =>
      names.some(
        (name) =>
          [card.name, card.flavor_name, card.printed_name].some(
            (cardName) =>
              cardName?.toLowerCase() === name.trim().toLowerCase(),
          ),
      ),
    )
  })
}

describe('prepareDeckImport', () => {
  it('resolves exact names and imports a Commander section', async () => {
    mockCards([commander, solRing])

    const prepared = await prepareDeckImport(
      'Commander\n1 Commander\nDeck\n1 Sol Ring',
      { ...currentDeck, commander: null },
    )

    expect(getCardsByExactNames).toHaveBeenCalledWith(
      ['Commander', 'Sol Ring'],
      undefined,
    )
    expect(prepared.deck.commander).toEqual(commander)
    expect(prepared.deck.cards[0]?.card).toEqual(solRing)
    expect(prepared.result.importedCards).toBe(2)
  })

  it('reports unknown cards and additional Commanders', async () => {
    const secondCommander = createCard(
      'second-printing',
      'Second Commander',
      'second-oracle',
      'Legendary Creature',
      ['U'],
    )
    mockCards([commander, secondCommander])

    const prepared = await prepareDeckImport(
      [
        'Commander',
        '1 Commander',
        '1 Second Commander',
        'Deck',
        '1 Missing Card',
      ].join('\n'),
      currentDeck,
    )

    expect(prepared.result.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Only one Commander is supported.',
        'No matching Scryfall card was found.',
      ]),
    )
  })

  it('combines basic-land quantities and repeated lines', async () => {
    mockCards([island])

    const prepared = await prepareDeckImport(
      'Deck\n4 Island\n2 Island',
      currentDeck,
    )

    expect(getCardsByExactNames).toHaveBeenCalledTimes(1)
    expect(prepared.deck.cards).toEqual([{ card: island, quantity: 6 }])
    expect(prepared.result.importedCards).toBe(6)
  })

  it('imports only one non-basic copy and reports duplicates', async () => {
    mockCards([solRing])

    const prepared = await prepareDeckImport(
      'Deck\n1 Sol Ring\n2 Sol Ring',
      currentDeck,
    )

    expect(prepared.deck.cards).toEqual([{ card: solRing, quantity: 1 }])
    expect(prepared.result.skippedCards).toBe(2)
    expect(prepared.result.issues[0]?.message).toContain('duplicate')
  })

  it('skips color-identity violations instead of overriding them', async () => {
    const redCard = createCard(
      'red-printing',
      'Red Card',
      'red-oracle',
      'Instant',
      ['R'],
    )
    mockCards([redCard])

    const prepared = await prepareDeckImport('Deck\n1 Red Card', currentDeck)

    expect(prepared.deck.cards).toHaveLength(0)
    expect(prepared.result.issues[0]?.message).toContain('color identity')
  })

  it('combines different names resolved to the same stable identity', async () => {
    const alternateIsland = {
      ...island,
      id: 'alternate-island-printing',
      name: 'Alternate Island',
    }
    mockCards([island, alternateIsland])

    const prepared = await prepareDeckImport(
      'Deck\n2 Island\n3 Alternate Island',
      currentDeck,
    )

    expect(prepared.deck.cards).toHaveLength(1)
    expect(prepared.deck.cards[0]?.quantity).toBe(5)
  })

  it('does not mutate the current deck when lookup fails', async () => {
    const originalDeck = structuredClone(currentDeck)
    vi.mocked(getCardsByExactNames).mockRejectedValue(
      new Error('Network unavailable'),
    )

    await expect(
      prepareDeckImport('Deck\n1 Sol Ring', currentDeck),
    ).rejects.toThrow('Network unavailable')
    expect(currentDeck).toEqual(originalDeck)
  })

  it('does not resolve or fail cards in untracked sections', async () => {
    mockCards([solRing])

    const prepared = await prepareDeckImport(
      [
        'Deck',
        '1 Sol Ring',
        'Companion',
        '1 Companion Card',
        'Acquireboard',
        '2 Acquire Card',
        'Tokens',
        '4 Token Card',
      ].join('\n'),
      currentDeck,
    )

    expect(getCardsByExactNames).toHaveBeenCalledTimes(1)
    expect(getCardsByExactNames).toHaveBeenCalledWith(
      ['Sol Ring'],
      undefined,
    )
    expect(prepared.result.skippedCards).toBe(0)
    expect(prepared.result.issues).toHaveLength(0)
    expect(prepared.result.ignoredSections).toEqual([
      { section: 'companion', cardCount: 1 },
      { section: 'acquireboard', cardCount: 2 },
      { section: 'tokens', cardCount: 4 },
    ])
  })

  it('retains the current Commander for a mainboard-only import', async () => {
    mockCards([solRing])

    const prepared = await prepareDeckImport('1 Sol Ring', currentDeck)

    expect(prepared.deck.commander).toEqual(commander)
    expect(prepared.result.commanderSource).toBe('retained')
  })

  it('sends normalized Moxfield card names to Scryfall', async () => {
    mockCards([solRing])

    await prepareDeckImport(
      'MAINBOARD\n1 Sol Ring (CMM) 396 *F*',
      currentDeck,
    )

    expect(getCardsByExactNames).toHaveBeenCalledWith(
      ['Sol Ring'],
      undefined,
    )
  })

  it('maps a flavor-name variant to its canonical card', async () => {
    const cyclonicRift = {
      ...solRing,
      id: 'cyclonic-rift-printing',
      oracle_id: 'cyclonic-rift-oracle',
      name: 'Cyclonic Rift',
      flavor_name: "Hope's Aero Magic",
      color_identity: ['U'],
    }
    mockCards([cyclonicRift])

    const prepared = await prepareDeckImport(
      "Mainboard\n1 Hope's Aero Magic",
      currentDeck,
    )

    expect(prepared.deck.cards[0]?.card.name).toBe('Cyclonic Rift')
    expect(prepared.result.issues).toHaveLength(0)
  })

  it('reports mainboard cards clearly when no Commander is available', async () => {
    mockCards([solRing])

    const prepared = await prepareDeckImport('1 Sol Ring', {
      ...currentDeck,
      commander: null,
    })

    expect(prepared.deck.cards).toHaveLength(0)
    expect(prepared.result.issues[0]?.message).toContain(
      'Choose a Commander',
    )
  })

  it('preserves tracked auxiliary boards without mainboard legality checks', async () => {
    const redCard = createCard(
      'red-printing',
      'Red Card',
      'red-oracle',
      'Instant',
      ['R'],
    )
    mockCards([redCard])

    const prepared = await prepareDeckImport(
      [
        'Sideboard',
        '2 Red Card',
        'Maybeboard',
        '3 Red Card',
        'Considering',
        '1 Red Card',
      ].join('\n'),
      currentDeck,
    )

    expect(prepared.deck.sideboard[0]?.quantity).toBe(2)
    expect(prepared.deck.maybeboard[0]?.quantity).toBe(3)
    expect(prepared.deck.considering[0]?.quantity).toBe(1)
    expect(prepared.result.issues).toHaveLength(0)
  })

  it('never sends decorative headings to Scryfall', async () => {
    mockCards([commander, solRing])

    await prepareDeckImport(
      '~~Commanders~~\n1 Commander\n~~Mainboard~~\n1 Sol Ring',
      { ...currentDeck, commander: null },
    )

    expect(getCardsByExactNames).toHaveBeenCalledWith(
      ['Commander', 'Sol Ring'],
      undefined,
    )
  })

  it('cautiously infers an eligible first Moxfield card as Commander', async () => {
    const inferredCommander = createCard(
      'inferred-printing',
      'Inferred Commander',
      'inferred-oracle',
      'Legendary Creature',
      ['U'],
    )
    mockCards([inferredCommander, island])
    vi.mocked(isCommanderEligible).mockResolvedValue(true)

    const prepared = await prepareDeckImport(
      '1 Inferred Commander\n99 Island',
      { ...currentDeck, commander: null },
      undefined,
      'moxfield',
    )

    expect(isCommanderEligible).toHaveBeenCalledWith(
      'Inferred Commander',
      undefined,
    )
    expect(prepared.deck.commander).toEqual(inferredCommander)
    expect(prepared.result.commanderSource).toBe('inferred')
    expect(prepared.deck.cards[0]?.quantity).toBe(99)
  })

  it('retains the current Commander when inference is not eligible', async () => {
    mockCards([solRing, island])
    vi.mocked(isCommanderEligible).mockResolvedValue(false)

    const prepared = await prepareDeckImport(
      '1 Sol Ring\n98 Island',
      currentDeck,
      undefined,
      'moxfield',
    )

    expect(prepared.deck.commander).toEqual(commander)
    expect(prepared.result.commanderSource).toBe('retained')
  })

  it('infers from a strongly Commander-shaped generic list', async () => {
    const inferredCommander = createCard(
      'generic-commander',
      'Generic Commander',
      'generic-commander-oracle',
      'Legendary Creature',
      ['U'],
    )
    mockCards([inferredCommander, island])
    vi.mocked(isCommanderEligible).mockResolvedValue(true)

    const prepared = await prepareDeckImport(
      '1 Generic Commander\n99 Island',
      { ...currentDeck, commander: null },
    )

    expect(prepared.result.commanderSource).toBe('inferred')
    expect(prepared.deck.commander).toEqual(inferredCommander)
  })
})
