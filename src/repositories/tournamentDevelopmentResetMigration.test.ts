import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607170012_fix_tournament_development_reset_filters.sql?raw'

const sql = migration.toLowerCase()

describe('tournament development reset migration', () => {
  it('clears only ingestion jobs and tournament-owned data', () => {
    expect(sql).toContain(
      'delete from public.tournament_ingestion_jobs where id is not null',
    )
    expect(sql).toContain(
      'delete from public.tournaments where id is not null',
    )
    expect(sql).not.toContain('delete from public.decks')
    expect(sql).not.toContain('delete from auth.users')
    expect(sql).not.toContain('delete from public.admin_users')
  })

  it('is callable only through the service role', () => {
    expect(sql).toContain('security definer')
    expect(sql).toContain('grant execute')
    expect(sql).toContain('to service_role')
  })
})
