import { describe, expect, it } from 'vitest';

import migration from '../../supabase/migrations/202607180004_bulk_mark_unavailable_tournament_decks.sql?raw';

const sql = migration.toLowerCase();

describe('bulk unavailable tournament Deck migration', () => {
  it('classifies missing and URL-only Decks in one insert', () => {
    expect(sql).toContain('mark_unavailable_tournament_decks');
    expect(sql).toContain("entry.decklist_availability in ('missing', 'url')");
    expect(sql).toContain("'unavailable_external_decklist'");
    expect(sql).toContain("'unavailable_decklist'");
    expect(sql).toContain('on conflict (tournament_entry_id) do nothing');
  });

  it('does not expose the write helper to browser roles', () => {
    expect(sql).toContain('security definer');
    expect(sql).toContain('revoke all');
    expect(sql).toContain('to service_role');
  });
});
