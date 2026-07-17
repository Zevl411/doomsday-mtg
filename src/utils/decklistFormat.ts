import type { DecklistFormat } from '../types/deckImport'
import { normalizeDecklistHeading } from './decklistHeadings'

export function detectDecklistFormat(text: string): DecklistFormat {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const headings = lines.map(normalizeDecklistHeading)

  const uppercaseHeadings = lines.map((line) =>
    line.replace(/:$/, '').trim(),
  )

  // Archidekt and Arena both append set and collector metadata. Check
  // Archidekt's decorated headings first so the broader Arena signal does not
  // make this branch unreachable.
  if (
    lines.some((line) => /^\s*(?:\*\*|#{1,6}\s|\[).+(?:\*\*|\])?\s*$/.test(line)) &&
    lines.some((line) => /\s+\([A-Z0-9]{2,6}\)\s+\S+/.test(line))
  ) {
    return 'archidekt'
  }

  if (lines.some((line) => /\s+\([a-z0-9]{2,6}\)\s+\S+\s*$/i.test(line))) {
    return 'arena'
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
