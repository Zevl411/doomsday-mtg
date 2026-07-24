import { describe, expect, it } from 'vitest';

import migrationText from '../../supabase/migrations/202607170001_create_decks_table.sql?raw';

const migration = migrationText.toLowerCase();

describe('Supabase decks migration', () => {
  it('enables RLS and defines every ownership policy', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('for select to authenticated');
    expect(migration).toContain('for insert to authenticated');
    expect(migration).toContain('for update to authenticated');
    expect(migration).toContain('for delete to authenticated');
    expect(migration.match(/auth\.uid\(\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('indexes owners, prevents duplicates, and updates timestamps', () => {
    expect(migration).toContain('decks_user_id_idx');
    expect(migration).toContain('unique (user_id, deck_id)');
    expect(migration).toContain('create trigger set_decks_updated_at');
  });
});
