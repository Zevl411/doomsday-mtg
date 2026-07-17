import { describe, expect, it } from 'vitest'
import { parseDecklist } from './decklistParser'

describe('parseDecklist', () => {
  it('parses supported quantity formats and quantity-less cards', () => {
    const parsed = parseDecklist(
      ['1 Sol Ring', '1x Arcane Signet', '4 Island', 'Command Tower'].join(
        '\n',
      ),
    )

    expect(parsed.lines.map(({ quantity, cardName }) => ({
      quantity,
      cardName,
    }))).toEqual([
      { quantity: 1, cardName: 'Sol Ring' },
      { quantity: 1, cardName: 'Arcane Signet' },
      { quantity: 4, cardName: 'Island' },
      { quantity: 1, cardName: 'Command Tower' },
    ])
  })

  it('ignores blanks and recognized headings', () => {
    const parsed = parseDecklist(
      'Commander:\n\n1 Atraxa, Praetors\' Voice\nMainboard\n1 Sol Ring',
    )

    expect(parsed.hasCommanderSection).toBe(true)
    expect(parsed.lines[0]?.section).toBe('commander')
    expect(parsed.lines[1]?.section).toBe('mainboard')
  })

  it.each(['0 Island', '-1 Island', '1.5 Island', '2.5x Island', '1xIsland'])(
    'reports malformed quantity in %s',
    (input) => {
      const parsed = parseDecklist(input)

      expect(parsed.lines).toHaveLength(0)
      expect(parsed.issues[0]).toMatchObject({
        lineNumber: 1,
        input,
      })
    },
  )

  it('preserves punctuation and double-faced separators', () => {
    const parsed = parseDecklist(
      "1 Atraxa, Praetors' Voice\nWear // Tear\nSword-of-Once and Future",
    )

    expect(parsed.lines.map((line) => line.cardName)).toEqual([
      "Atraxa, Praetors' Voice",
      'Wear // Tear',
      'Sword-of-Once and Future',
    ])
  })

  it.each([
    '1 Sink into Stupor / Soporific Springs',
    '1 Sink into Stupor//Soporific Springs',
    '1 Sink into Stupor // Soporific Springs',
  ])('normalizes face separator in %s', (input) => {
    const parsed = parseDecklist(input)

    expect(parsed.lines[0]?.cardName).toBe(
      'Sink into Stupor // Soporific Springs',
    )
  })

  it('preserves repeated lines and original line numbers', () => {
    const parsed = parseDecklist('1 Island\n\n2 Island')

    expect(parsed.lines).toHaveLength(2)
    expect(parsed.lines.map((line) => line.lineNumber)).toEqual([1, 3])
  })

  it('normalizes Arena metadata and ignores its sideboard', () => {
    const parsed = parseDecklist(
      [
        'Commander',
        '1 Atraxa, Grand Unifier (ONE) 196',
        'Deck',
        '4 Lightning Bolt (STA) 42',
        '1 Otawara, Soaring City (NEO) 271',
        'Sideboard',
        '2 Disdainful Stroke (KHM) 54',
      ].join('\n'),
    )

    expect(parsed.format).toBe('arena')
    expect(parsed.lines.map((line) => line.cardName)).toEqual([
      'Atraxa, Grand Unifier',
      'Lightning Bolt',
      'Otawara, Soaring City',
      'Disdainful Stroke',
    ])
    expect(parsed.lines.at(-1)?.section).toBe('sideboard')
    expect(parsed.ignoredSections).toEqual([])
    expect(parsed.issues).toHaveLength(0)
  })

  it('handles Moxfield sections and conservative category headings', () => {
    const parsed = parseDecklist(
      [
        'COMMANDER',
        "1 Atraxa, Praetors' Voice",
        'MAINBOARD',
        'Creatures',
        '1 Birds of Paradise',
        'Command Tower',
        'MAYBEBOARD',
        '2 Teferi, Time Raveler',
        'Considering:',
        'Sol Ring',
      ].join('\n'),
    )

    expect(parsed.format).toBe('moxfield')
    expect(parsed.lines.map((line) => line.cardName)).not.toContain(
      'Creatures',
    )
    expect(parsed.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardName: 'Command Tower',
          quantity: 1,
          section: 'mainboard',
        }),
      ]),
    )
    expect(parsed.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section: 'maybeboard', quantity: 2 }),
        expect.objectContaining({ section: 'considering', quantity: 1 }),
      ]),
    )
  })

  it('skips an obvious generic category heading before quantified cards', () => {
    const parsed = parseDecklist('Artifacts\n1 Sol Ring\n1 Arcane Signet')

    expect(parsed.lines.map((line) => line.cardName)).toEqual([
      'Sol Ring',
      'Arcane Signet',
    ])
    expect(parsed.skippedCategoryHeadings).toEqual([
      expect.objectContaining({ input: 'Artifacts' }),
    ])
  })

  it('keeps an unknown plausible card name for Scryfall resolution', () => {
    const parsed = parseDecklist('Unfamiliar Future Card\n1 Sol Ring')

    expect(parsed.lines[0]?.cardName).toBe('Unfamiliar Future Card')
  })

  it('removes Moxfield printing and foil annotations from card names', () => {
    const parsed = parseDecklist(
      [
        'COMMANDER',
        "1 Atraxa, Praetors' Voice (2X2) 179 *F*",
        'MAINBOARD',
        '1 Sol Ring (CMM) 396',
        '1 Fire // Ice (MH2) 290 *F*',
      ].join('\n'),
    )

    expect(parsed.lines.map((line) => line.cardName)).toEqual([
      "Atraxa, Praetors' Voice",
      'Sol Ring',
      'Fire // Ice',
    ])
  })

  it('keeps MTGO mainboard state across blanks and ignores sideboard', () => {
    const parsed = parseDecklist(
      '4 Lightning Bolt\n\n2 Counterspell\nSideboard:\n2 Pyroblast',
    )

    expect(parsed.format).toBe('mtgo')
    expect(parsed.lines[1]).toMatchObject({
      cardName: 'Counterspell',
      section: 'mainboard',
    })
    expect(parsed.lines.at(-1)?.section).toBe('sideboard')
    expect(parsed.ignoredSections).toEqual([])
  })

  it('recognizes headings case-insensitively with optional colons', () => {
    const parsed = parseDecklist(
      'cOmMaNd ZoNe:\n1 Commander\nmAiN:\n1 Sol Ring\nCOMPANION:\n1 Lurrus of the Dream-Den',
    )

    expect(parsed.lines.map((line) => line.section)).toEqual([
      'commander',
      'mainboard',
    ])
    expect(parsed.ignoredSections).toEqual([
      { section: 'companion', cardCount: 1 },
    ])
  })

  it('strips whitespace-separated hash comments but preserves faces', () => {
    const parsed = parseDecklist(
      '1 Sol Ring # ramp\n1 Fire // Ice\n1 Circle of Protection: Art',
    )

    expect(parsed.lines.map((line) => line.cardName)).toEqual([
      'Sol Ring',
      'Fire // Ice',
      'Circle of Protection: Art',
    ])
  })

  it('parses decorative headings without producing card lines', () => {
    const parsed = parseDecklist(
      [
        '~~Commanders~~',
        '1 Sisay, Weatherlight Captain',
        '',
        '~~Mainboard~~',
        "1 Agatha's Soul Cauldron",
        '**Sideboard**',
        '1 Red Elemental Blast',
        '## Maybeboard',
        '1 Silence',
        '[Considering]',
        '1 Flusterstorm',
      ].join('\n'),
      'moxfield',
    )

    expect(parsed.lines.map((line) => line.section)).toEqual([
      'commander',
      'mainboard',
      'sideboard',
      'maybeboard',
      'considering',
    ])
    expect(parsed.lines.map((line) => line.cardName)).not.toContain(
      '~~Mainboard~~',
    )
  })

  it('supports inline board prefixes that override the active section', () => {
    const parsed = parseDecklist(
      [
        'Mainboard',
        'sideboard: 1 Red Elemental Blast',
        'considering: Flusterstorm',
        'consider: 1 Swan Song',
        'maybe: 1 Silence',
        'maybeboard: Enlightened Tutor',
        'commander: 1 Sisay, Weatherlight Captain',
      ].join('\n'),
    )

    expect(parsed.lines.map((line) => line.section)).toEqual([
      'sideboard',
      'considering',
      'considering',
      'maybeboard',
      'maybeboard',
      'commander',
    ])
    expect(parsed.hasCommanderSection).toBe(true)
  })

  it('honors a manually selected Archidekt format and skips categories', () => {
    const parsed = parseDecklist(
      'Mainboard\n**Ramp**\n1 Sol Ring (CMM) 396\nMaybeboard\n1 Silence',
      'archidekt',
    )

    expect(parsed.format).toBe('archidekt')
    expect(parsed.lines.map((line) => line.cardName)).toEqual([
      'Sol Ring',
      'Silence',
    ])
    expect(parsed.skippedCategoryHeadings).toHaveLength(1)
  })
})
