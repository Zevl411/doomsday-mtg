import { describe, expect, it } from 'vitest';

import migration from '../../supabase/migrations/202607170005_create_tournament_ingestion_jobs.sql?raw';

const sql = migration.toLowerCase();

describe('historical ingestion job migration', () => {
  it('creates durable jobs and unique date-window batches', () => {
    expect(sql).toContain('create table if not exists public.tournament_ingestion_jobs');
    expect(sql).toContain('create table if not exists public.tournament_ingestion_batches');
    expect(sql).toContain('unique (job_id, start_date, end_date)');
    expect(sql).toContain('window_days between 1 and 15');
  });

  it('claims one batch safely and recovers abandoned work', () => {
    expect(sql).toContain('for update of batch skip locked limit 1');
    expect(sql).toContain("started_at < now() - interval '15 minutes'");
    expect(sql).toContain("attempts >= 3 then 'failed'");
  });

  it('keeps mutations behind the service role', () => {
    expect(sql).toContain('to service_role');
    expect(sql).toContain('revoke insert, update, delete');
    expect(sql).toContain('admins can read ingestion jobs');
  });
});
