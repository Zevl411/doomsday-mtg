import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607170009_backfill_tournament_commander_colors.sql?raw'

const sql = migration.toLowerCase()

describe('tournament Commander color backfill', () => {
  it('derives entry identities from normalized Commander cards', () => {
    expect(sql).toContain("where card.board = 'commander'")
    expect(sql).toContain('unnest(card.color_identity)')
    expect(sql).toContain('update public.tournament_entries')
    expect(sql).toContain('set')
    expect(sql).toContain('color_identity = identity.color_identity')
  })
})
