import type { DecklistFormat } from '../types/deckImport'
import { normalizeDecklistHeading } from './decklistHeadings'

export function detectDecklistFormat(text: string): DecklistFormat {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const headings = lines.map(normalizeDecklistHeading)

  // Arena metadata appears only at the end of a card line with a set code and
  // collector number, making it the strongest format signal.
  if (lines.some((line) => /\s+\([a-z0-9]{2,6}\)\s+\S+\s*$/i.test(line))) {
    return 'arena'
  }

  const uppercaseHeadings = lines.map((line) =>
    line.replace(/:$/, '').trim(),
  )

  if (
    lines.some((line) => /^\s*(?:\*\*|#{1,6}\s|\[).+(?:\*\*|\])?\s*$/.test(line)) &&
    lines.some((line) => /\s+\([A-Z0-9]{2,6}\)\s+\S+/.test(line))
  ) {
    return 'archidekt'
  }

  if (
    headings.some((heading) =>
      ['mainboard', 'maybeboard', 'considering', 'acquireboard'].includes(
        heading,
      ),
    ) ||
    uppercaseHeadings.some((heading) =>
      ['COMMANDER', 'MAINBOARD', 'MAYBEBOARD', 'CONSIDERING'].includes(
        heading,
      ),
    ) ||
    lines.some((line) => /^~~.+~~$/.test(line))
  ) {
    return 'moxfield'
  }

  if (
    headings.includes('sideboard') &&
    !headings.some((heading) =>
      ['commander', 'commanders', 'command zone', 'deck'].includes(heading),
    )
  ) {
    return 'mtgo'
  }

  return 'generic'
}

export function getDecklistFormatLabel(format: DecklistFormat): string {
  const labels: Record<DecklistFormat, string> = {
    generic: 'Generic plaintext',
    moxfield: 'Moxfield-style',
    archidekt: 'Archidekt',
    arena: 'MTG Arena',
    mtgo: 'Magic Online',
  }

  return labels[format]
}
