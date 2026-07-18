import { describe, expect, it } from 'vitest'
import {
  formatElapsedDuration,
  getIngestionJobDurationMs,
} from './ingestionDuration'

describe('ingestion job duration', () => {
  it('uses persisted completion time for finished jobs', () => {
    expect(getIngestionJobDurationMs({
      startedAt: '2026-07-18T01:00:00.000Z',
      completedAt: '2026-07-18T08:02:03.000Z',
    })).toBe(25_323_000)
    expect(formatElapsedDuration(25_323_000)).toBe('7h 2m 3s')
  })

  it('uses current time for active jobs and handles queued jobs', () => {
    expect(getIngestionJobDurationMs(
      { startedAt: '2026-07-18T01:00:00.000Z' },
      Date.parse('2026-07-18T01:05:04.000Z'),
    )).toBe(304_000)
    expect(getIngestionJobDurationMs({})).toBeNull()
    expect(formatElapsedDuration(304_000)).toBe('5m 4s')
  })
})
