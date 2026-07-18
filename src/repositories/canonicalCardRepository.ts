import { supabase } from '../lib/supabase'
import type { ScryfallCard } from '../types/card'

export interface CanonicalCardSearchOptions {
  commanderOnly?: boolean
  allowedColorIdentity?: string[]
}

interface CanonicalCardRow {
  id: string
  oracle_id?: string | null
  scryfall_id?: string | null
  card_name: string
  type_line?: string | null
  color_identity?: string[] | null
}

/**
 * Canonical cards are a degraded search fallback, not a Scryfall replacement.
 * They contain the legality fields the Deck Builder needs but not every piece
 * of printing metadata returned by Scryfall.
 */
export async function searchCanonicalCards(
  query: string,
  options: CanonicalCardSearchOptions = {},
): Promise<ScryfallCard[]> {
  if (!supabase || !query.trim()) return []

  const pattern = `%${query.trim()}%`
  let rows: CanonicalCardRow[] = []

  if (options.commanderOnly) {
    const { data, error } = await supabase
      .from('tournament_deck_cards')
      .select('canonical_cards!inner(*)')
      .eq('board', 'commander')
      .ilike('canonical_cards.card_name', pattern)
      .limit(50)
    if (error) throw new Error('Unable to search the canonical card cache.')

    rows = (data ?? []).flatMap((item) => {
      const relation = item.canonical_cards
      const card = Array.isArray(relation) ? relation[0] : relation
      return card ? [card as CanonicalCardRow] : []
    })
  } else {
    const { data, error } = await supabase
      .from('canonical_cards')
      .select('*')
      .ilike('card_name', pattern)
      .order('card_name')
      .limit(25)
    if (error) throw new Error('Unable to search the canonical card cache.')
    rows = (data ?? []) as CanonicalCardRow[]
  }

  const uniqueRows = new Map(rows.map((row) => [row.id, row]))
  return [...uniqueRows.values()]
    .filter((row) =>
      isWithinColorIdentity(
        row.color_identity ?? [],
        options.allowedColorIdentity,
      )
    )
    .sort((left, right) => left.card_name.localeCompare(right.card_name))
    .slice(0, 25)
    .map(toScryfallCard)
}

function isWithinColorIdentity(
  cardColors: string[],
  allowedColors?: string[],
): boolean {
  if (!allowedColors) return true
  return cardColors.every((color) => allowedColors.includes(color))
}

function toScryfallCard(row: CanonicalCardRow): ScryfallCard {
  const exactName = encodeURIComponent(row.card_name)
  const imageBase =
    `https://api.scryfall.com/cards/named?exact=${exactName}&format=image`

  return {
    id: row.scryfall_id ?? row.id,
    oracle_id: row.oracle_id ?? undefined,
    name: row.card_name,
    type_line: row.type_line ?? 'Type unavailable',
    color_identity: row.color_identity ?? [],
    image_uris: {
      small: `${imageBase}&version=small`,
      normal: `${imageBase}&version=normal`,
      large: `${imageBase}&version=large`,
    },
  }
}
