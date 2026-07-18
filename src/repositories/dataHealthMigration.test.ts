import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607180007_add_data_health_reporting.sql?raw'

const sql = migration.toLowerCase()

describe('data health migration', () => {
  it('creates focused bounded health RPCs', () => {
    expect(sql).toContain('function public.get_data_health_summary')
    expect(sql).toContain('function public.get_data_health_region_coverage')
    expect(sql).toContain('function public.get_commander_analytics_readiness')
    expect(sql).toContain('function public.get_unresolved_card_health')
    expect(sql).toContain('function public.get_ingestion_job_health')
    expect(sql).toContain(
      'limit greatest(1, least(coalesce(p_limit, 100), 250))',
    )
  })

  it('enforces admin membership and excludes anonymous execution', () => {
    expect(sql.match(/administrator access required/g)?.length)
      .toBeGreaterThanOrEqual(4)
    expect(sql).toContain('revoke all on function public.get_data_health_summary')
    expect(sql).toContain('from public, anon')
    expect(sql).toContain('to authenticated')
    expect(sql).not.toContain('from public.decks')
  })

  it('uses the centralized readiness thresholds and paired diagnostics', () => {
    expect(sql).toContain("when complete = 0 then 'unavailable'")
    expect(sql).toContain("when complete < 5 then 'insufficient'")
    expect(sql).toContain("when complete < 20 then 'limited'")
    expect(sql).toContain("else 'sufficient'")
    expect(sql).toContain("entry.commander_key like '% // %' paired")
    expect(sql).toContain('one_sided_extraction_failure_count')
  })

  it('adds only query-path indexes needed by the reports', () => {
    expect(sql).toContain('tournament_entries_commander_tournament_idx')
    expect(sql).toContain('tournament_decks_status_commander_idx')
    expect(sql).toContain('tournament_ingestion_jobs_status_updated_idx')
  })
})
