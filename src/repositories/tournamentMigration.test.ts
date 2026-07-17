import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607170002_create_tournament_data.sql?raw'

const sql = migration.toLowerCase()

describe('tournament migration', () => {
  it('creates stable tournament and entry identities with useful indexes', () => {
    expect(sql).toContain('unique (source, source_tournament_id)')
    expect(sql).toContain('unique (tournament_id, source_entry_key)')
    expect(sql).toContain('tournament_entries_commander_key_idx')
    expect(sql).toContain('tournaments_event_date_idx')
  })

  it('allows public reads without browser writes', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('for select to anon, authenticated')
    expect(sql).not.toContain('on public.tournaments for insert')
    expect(sql).not.toContain('on public.tournament_entries for insert')
  })

  it('defines server-side aggregation formulas', () => {
    expect(sql).toContain('get_commander_metagame')
    expect(sql).toContain('g.wins::numeric / (g.wins + g.losses + g.draws)')
    expect(sql).toContain('g.top16_finishes::numeric / g.entries')
  })
})
