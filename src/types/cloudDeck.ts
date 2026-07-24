import type { Deck } from '../models/deck';

/** Database row names stay here so snake_case does not leak into UI code. */
export interface CloudDeckRecord {
  id: string;
  user_id: string;
  deck_id: string;
  name: string;
  // Legacy rows created before deck sharing may not expose these columns yet.
  description?: string | null;
  visibility?: NonNullable<Deck['visibility']> | null;
  creator_username?: string | null;
  deck_data: Deck;
  schema_version: number;
  created_at: string;
  updated_at: string;
}
