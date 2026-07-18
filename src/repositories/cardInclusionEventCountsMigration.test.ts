import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607180010_add_event_counts_to_card_history.sql?raw'

const sql = migration.toLowerCase()

describe('card inclusion event count migration', () => {
  it('counts distinct tournaments inside each selected period', () => {
    expect(sql).toContain('tournament.id as event_id')
    expect(sql).toContain('count(distinct eligible.event_id)::bigint as events')
    expect(sql).toContain('event_count bigint')
  })

  it('recreates and restores public execution access', () => {
    expect(sql).toContain(
      'drop function if exists public.get_commander_card_inclusion_over_time',
    )
    expect(sql).toContain('to anon, authenticated')
  })
})
