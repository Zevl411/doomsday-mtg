import { describe, expect, it } from 'vitest'
import {
  getDecklistBoardHeading,
  normalizeDecklistHeading,
} from './decklistHeadings'

describe('decklist heading normalization', () => {
  it.each([
    ['~~Commanders~~', 'commander'],
    ['~~Mainboard~~', 'mainboard'],
    ['**Sideboard**', 'sideboard'],
    ['## Maybeboard', 'maybeboard'],
    ['[Considering]', 'considering'],
    ['-- Sideboard --', 'sideboard'],
    ['=== Maybeboard ===', 'maybeboard'],
    ['CoMmAnD ZoNe:', 'commander'],
  ])('recognizes %s as %s', (input, board) => {
    expect(getDecklistBoardHeading(input)).toBe(board)
  })

  it('does not damage ordinary card names while checking headings', () => {
    expect(normalizeDecklistHeading("Atraxa, Praetors' Voice")).toBe(
      "atraxa, praetors' voice",
    )
    expect(getDecklistBoardHeading("Atraxa, Praetors' Voice")).toBeNull()
  })
})
