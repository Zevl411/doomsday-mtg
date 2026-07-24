import { describe, expect, it } from 'vitest';

import migration from '../../supabase/migrations/202607180003_include_canonical_cards_in_dev_reset.sql?raw';

const sql = migration.toLowerCase();

describe('canonical card development reset migration', () => {
  it('clears canonical cards after tournament-owned rows', () => {
    const tournaments = sql.indexOf('delete from public.tournaments where id is not null');
    const canonical = sql.indexOf('delete from public.canonical_cards where id is not null');
    expect(tournaments).toBeGreaterThan(-1);
    expect(canonical).toBeGreaterThan(tournaments);
    expect(sql).toContain("'canonicalcardsdeleted'");
    expect(sql).toContain("'canonicalaliasesdeleted'");
  });

  it('preserves user Decks and authentication records', () => {
    expect(sql).not.toContain('delete from public.decks');
    expect(sql).not.toContain('delete from auth.users');
    expect(sql).not.toContain('delete from public.admin_users');
  });
});
